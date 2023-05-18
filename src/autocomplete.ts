import { ASTBase, ASTCallExpression, ASTType } from 'greyscript-core';
import {
  getDefinitions,
  SignatureDefinitionArg,
  SignatureDefinitionContainer
} from 'greyscript-meta';
import vscode, {
  CancellationToken,
  CompletionContext,
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  ExtensionContext,
  ParameterInformation,
  Position,
  ProviderResult,
  Range,
  SignatureHelp,
  SignatureHelpContext,
  SignatureInformation,
  TextDocument
} from 'vscode';

import { AVAILABLE_CONSTANTS } from './autocomplete/constants';
import { AVAILABLE_KEYWORDS } from './autocomplete/keywords';
import { AVAILABLE_OPERATORS } from './autocomplete/operators';
import documentParseQueue from './helper/document-manager';
import { LookupHelper } from './helper/lookup-type';
import { TypeInfo, TypeInfoWithDefinition } from './helper/type-manager';

export const convertDefinitionsToCompletionList = (
  definitions: SignatureDefinitionContainer
): CompletionItem[] => {
  const completionItems: CompletionItem[] = [];
  const keys = Object.keys(definitions);

  for (let index = 0; index < keys.length; index++) {
    completionItems.push(
      new CompletionItem(keys[index], CompletionItemKind.Function)
    );
  }

  return completionItems;
};

export const getCompletionList = (
  helper: LookupHelper,
  item: ASTBase
): CompletionList | null => {
  const typeInfo = helper.lookupBasePath(item);

  if (typeInfo instanceof TypeInfoWithDefinition) {
    const definitions = getDefinitions(typeInfo.definition.returns);
    const completionItems: CompletionItem[] = [
      ...convertDefinitionsToCompletionList(definitions)
    ];

    if (completionItems.length > 0) {
      return new CompletionList(completionItems);
    }
  } else if (typeInfo instanceof TypeInfo) {
    const definitions = getDefinitions(typeInfo.type);
    const completionItems: CompletionItem[] = [
      ...convertDefinitionsToCompletionList(definitions)
    ];

    if (completionItems.length > 0) {
      return new CompletionList(completionItems);
    }
  }

  return null;
};

export function activate(_context: ExtensionContext) {
  vscode.languages.registerCompletionItemProvider('greyscript', {
    async provideCompletionItems(
      document: TextDocument,
      position: Position,
      _token: CancellationToken,
      _ctx: CompletionContext
    ) {
      documentParseQueue.refresh(document);

      const currentRange = new Range(position.translate(0, -1), position);

      if (document.getText(currentRange) === '.') {
        const definitions = getDefinitions(['any']);
        const completionItems: CompletionItem[] = [
          ...convertDefinitionsToCompletionList(definitions)
        ];

        if (completionItems.length > 0) {
          return new CompletionList(completionItems);
        }
      }

      const helper = new LookupHelper(document);
      const astResult = helper.lookupAST(position);

      if (astResult) {
        const { outer } = astResult;
        const previous = outer.length > 0 ? outer[outer.length - 1] : undefined;

        if (
          previous?.type === ASTType.MemberExpression ||
          previous?.type === ASTType.IndexExpression
        ) {
          const list = getCompletionList(helper, previous);
          if (list) return list;
        }
      }

      // get all default methods
      const defaultDefinitions = getDefinitions(['general']);
      const completionItems: CompletionItem[] = [
        ...AVAILABLE_KEYWORDS,
        ...AVAILABLE_OPERATORS,
        ...AVAILABLE_CONSTANTS,
        ...convertDefinitionsToCompletionList(defaultDefinitions)
      ];

      if (!astResult) {
        return new CompletionList(completionItems);
      }

      const existingProperties = new Set([
        ...completionItems.map((item) => item.label)
      ]);
      const allImports = await documentParseQueue.getImportsOf(document);

      for (const item of allImports) {
        const { document } = item;

        if (!document) {
          continue;
        }

        completionItems.push(
          ...helper
            .findAllAvailableIdentifier(document)
            .filter((property: string) => !existingProperties.has(property))
            .map((property: string) => {
              existingProperties.add(property);
              return new CompletionItem(property, CompletionItemKind.Variable);
            })
        );
      }

      // get all identifer available in scope
      completionItems.push(
        ...helper
          .findAllAvailableIdentifierRelatedToPosition(astResult.closest)
          .filter((property: string) => !existingProperties.has(property))
          .map((property: string) => {
            existingProperties.add(property);
            return new CompletionItem(property, CompletionItemKind.Variable);
          })
      );

      return new CompletionList(completionItems);
    }
  });

  vscode.languages.registerSignatureHelpProvider(
    'greyscript',
    {
      provideSignatureHelp(
        document: TextDocument,
        position: Position,
        _token: CancellationToken,
        _ctx: SignatureHelpContext
      ): ProviderResult<SignatureHelp> {
        documentParseQueue.refresh(document);
        const helper = new LookupHelper(document);
        const astResult = helper.lookupAST(position);

        if (!astResult) {
          return;
        }

        // filter out root call expression for signature
        let rootCallExpression: ASTCallExpression | undefined;

        if (astResult.closest.type === 'CallExpression') {
          rootCallExpression = astResult.closest as ASTCallExpression;
        } else {
          for (let index = astResult.outer.length - 1; index >= 0; index--) {
            const current = astResult.outer[index];

            if (current.type === 'CallExpression') {
              rootCallExpression = current as ASTCallExpression;
              break;
            }
          }
        }

        if (!rootCallExpression) {
          return;
        }

        const root = helper.lookupScope(astResult.closest);
        const item = helper.lookupTypeInfo({
          closest: rootCallExpression,
          outer: root ? [root] : []
        });

        if (!item || !(item instanceof TypeInfoWithDefinition)) {
          return;
        }

        // figure out argument position
        const astArgs = rootCallExpression.arguments;
        const selectedIndex = astArgs.findIndex((argItem: ASTBase) => {
          const leftIndex = argItem.start!.character - 1;
          const rightIndex = argItem.end!.character;

          return (
            leftIndex <= position.character && rightIndex >= position.character
          );
        });

        const signatureHelp = new SignatureHelp();

        signatureHelp.activeParameter =
          selectedIndex === -1 ? 0 : selectedIndex;
        signatureHelp.signatures = [];
        signatureHelp.activeSignature = 0;

        const definition = item.definition;
        const args = definition.arguments || [];
        const returnValues = definition.returns.join(' or ') || 'null';
        const argValues = args
          .map(
            (item: SignatureDefinitionArg) =>
              `${item.label}${item.opt ? '?' : ''}: ${item.type}`
          )
          .join(', ');
        const signatureInfo = new SignatureInformation(
          `(${item.type}) ${item.label} (${argValues}): ${returnValues}`
        );
        const params: ParameterInformation[] = args.map(
          (argItem: SignatureDefinitionArg) => {
            return new ParameterInformation(
              `${argItem.label}${argItem.opt ? '?' : ''}: ${argItem.type}`
            );
          }
        );

        signatureInfo.parameters = params;
        signatureHelp.signatures.push(signatureInfo);

        return signatureHelp;
      }
    },
    ',',
    '('
  );
}
