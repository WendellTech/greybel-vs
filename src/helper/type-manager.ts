import { ASTChunkAdvanced } from 'greybel-core';
import {
  ASTAssignmentStatement,
  ASTBase,
  ASTBaseBlockWithScope,
  ASTCallExpression,
  ASTCallStatement,
  ASTFunctionStatement,
  ASTIdentifier,
  ASTIndexExpression,
  ASTLiteral,
  ASTMemberExpression,
  ASTType
} from 'greyscript-core';
import {
  getDefinition,
  getDefinitions,
  SignatureDefinition,
  SignatureDefinitionArg
} from 'greyscript-meta';
import { TextDocument } from 'vscode';

import ASTStringify from './ast-stringify';

export class TypeInfo {
  label: string;
  type: string[];

  constructor(label: string, type: string[]) {
    this.label = label;
    this.type = type;
  }
}

export class TypeInfoWithDefinition extends TypeInfo {
  definition: SignatureDefinition;

  constructor(label: string, type: string[], definition: SignatureDefinition) {
    super(label, type);
    this.definition = definition;
  }
}

export const lookupIdentifier = (root: ASTBase): ASTBase | null => {
  // non greey identifier to string method; can be used instead of ASTStringify
  switch (root.type) {
    case ASTType.CallStatement:
      return lookupIdentifier((root as ASTCallStatement).expression);
    case ASTType.CallExpression:
      return lookupIdentifier((root as ASTCallExpression).base);
    case ASTType.Identifier:
      return root;
    case ASTType.MemberExpression:
      return lookupIdentifier((root as ASTMemberExpression).identifier);
    case ASTType.IndexExpression:
      return lookupIdentifier((root as ASTIndexExpression).index);
    default:
      return null;
  }
};

export const lookupBase = (node: ASTBase | null = null): ASTBase | null => {
  switch (node?.type) {
    case ASTType.MemberExpression:
      return (node as ASTMemberExpression).base;
    case ASTType.IndexExpression:
      return (node as ASTIndexExpression).base;
    case ASTType.CallExpression:
      return (node as ASTCallExpression).base;
    default:
      return null;
  }
};

export class TypeMap {
  private root: ASTChunkAdvanced;
  private refs: WeakMap<ASTBase, Map<string, TypeInfo>>;

  constructor(root: ASTChunkAdvanced) {
    this.root = root;
    this.refs = new WeakMap();
  }

  resolvePath(item: ASTBase): TypeInfo | null {
    const me = this;
    let base: ASTBase | null = item;
    const traversalPath = [];

    // prepare traversal path
    while (base) {
      if (base.type === ASTType.CallExpression) {
        base = lookupBase(base);
        continue;
      }

      const identifer = lookupIdentifier(base);
      traversalPath.unshift(identifer || base);

      base = lookupBase(base);
    }

    // retreive type
    let origin;
    let currentMetaInfo: TypeInfo | null = null;

    while ((origin = traversalPath.shift())) {
      switch (origin.type) {
        case ASTType.Identifier: {
          const identifer = origin as ASTIdentifier;
          const name = identifer.name;

          // resolve first identifier
          if (!currentMetaInfo) {
            currentMetaInfo =
              me.resolveIdentifier(identifer) || new TypeInfo(name, ['any']);
            break;
          }

          // get signature
          let definitions = null;

          if (currentMetaInfo instanceof TypeInfoWithDefinition) {
            const definition = currentMetaInfo.definition;
            definitions = getDefinitions(definition.returns);
          } else {
            definitions = getDefinitions(currentMetaInfo.type);
          }

          if (name in definitions) {
            const definition = definitions[name];
            currentMetaInfo = new TypeInfoWithDefinition(
              name,
              ['function'],
              definition
            );
            break;
          }

          // todo add retrieval for object/lists
          return null;
        }
        case ASTType.IndexExpression: {
          // add index
          console.log('not yet supported');
          return null;
        }
        default: {
          if (!currentMetaInfo) {
            currentMetaInfo = me.resolveDefault(origin);
            break;
          }
          return null;
        }
      }
    }

    return currentMetaInfo;
  }

  private resolveIdentifier(item: ASTIdentifier): TypeInfo | null {
    const me = this;
    const name = item.name;

    // special behavior for global variables
    switch (name) {
      case 'params':
        return new TypeInfo(name, ['list:string']);
      case 'globals':
        return new TypeInfo(name, ['map:any']);
      case 'locals':
        return new TypeInfo(name, ['map:any']);
      case 'self':
        return new TypeInfo(name, ['map:any']);
    }

    // check for default namespace
    const defaultDef = getDefinition(['general'], name);

    if (defaultDef) {
      return new TypeInfoWithDefinition(name, ['function'], defaultDef);
    }

    // get type info from scopes
    let currentScope = item.scope;

    while (currentScope) {
      if (me.refs.has(currentScope)) {
        const typeMap = me.refs.get(currentScope)!;

        if (typeMap.has(name)) {
          const typeInfo = typeMap.get(name)!;
          return typeInfo;
        }
      }

      currentScope = currentScope.scope;
    }

    return null;
  }

  private resolveFunctionDeclaration(
    item: ASTFunctionStatement
  ): TypeInfoWithDefinition | null {
    const me = this;

    return new TypeInfoWithDefinition('anonymous', ['function'], {
      arguments: item.parameters.map((arg: ASTBase) => {
        if (arg.type === ASTType.Identifier) {
          return {
            label: ASTStringify(arg),
            type: 'any'
          } as SignatureDefinitionArg;
        }

        const assignment = arg as ASTAssignmentStatement;

        return {
          label: ASTStringify(assignment.variable),
          type: me.resolve(assignment.init)?.type[0] || 'any'
        };
      }),
      returns: ['any'],
      description: 'This is a custom method.'
    });
  }

  private resolveCallStatement(item: ASTCallStatement): TypeInfo | null {
    const { expression } = item;
    return this.resolve(expression);
  }

  private resolveCallExpression(item: ASTCallExpression): TypeInfo | null {
    const { base } = item;
    return this.resolve(base);
  }

  private resolveDefault(item: ASTBase): TypeInfo | null {
    switch (item.type) {
      case ASTType.NilLiteral:
        return new TypeInfo((item as ASTLiteral).raw.toString(), ['null']);
      case ASTType.StringLiteral:
        return new TypeInfo((item as ASTLiteral).raw.toString(), ['string']);
      case ASTType.NumericLiteral:
        return new TypeInfo((item as ASTLiteral).raw.toString(), ['number']);
      case ASTType.BooleanLiteral:
        return new TypeInfo((item as ASTLiteral).raw.toString(), ['boolean']);
      case ASTType.MapConstructorExpression:
        return new TypeInfo('{}', ['map:any']);
      case ASTType.ListConstructorExpression:
        return new TypeInfo('[]', ['list:any']);
      case ASTType.BinaryExpression:
        return new TypeInfo('Binary expression', [
          'number',
          'string',
          'list:any',
          'map:any'
        ]);
      case ASTType.LogicalExpression:
        return new TypeInfo('Logical expression', ['boolean']);
      default:
        return null;
    }
  }

  resolve(item: ASTBase): TypeInfo | null {
    const me = this;

    switch (item.type) {
      case ASTType.Identifier:
        return me.resolveIdentifier(item as ASTIdentifier);
      case ASTType.MemberExpression:
      case ASTType.IndexExpression:
        return me.resolvePath(item);
      case ASTType.FunctionDeclaration:
        return me.resolveFunctionDeclaration(item as ASTFunctionStatement);
      case ASTType.CallStatement:
        return me.resolveCallStatement(item as ASTCallStatement);
      case ASTType.CallExpression:
        return me.resolveCallExpression(item as ASTCallExpression);
      case ASTType.NilLiteral:
      case ASTType.StringLiteral:
      case ASTType.NumericLiteral:
      case ASTType.BooleanLiteral:
      case ASTType.MapConstructorExpression:
      case ASTType.ListConstructorExpression:
      case ASTType.BinaryExpression:
      case ASTType.LogicalExpression:
        return me.resolveDefault(item);
      default:
        return null;
    }
  }

  private analyzeScope(scope: ASTBaseBlockWithScope) {
    const me = this;
    const identiferTypes: Map<string, TypeInfo> = new Map();
    const assignments = scope.assignments as ASTAssignmentStatement[];

    me.refs.set(scope, identiferTypes);

    for (const assignment of assignments) {
      if (!(assignment.variable instanceof ASTIdentifier)) continue;

      const name = assignment.variable.name;
      const resolved = me.resolve(assignment.init);

      if (resolved === null) continue;

      const typeInfo =
        resolved instanceof TypeInfoWithDefinition
          ? new TypeInfo(name, resolved.definition.returns || ['any'])
          : new TypeInfo(name, resolved.type);

      if (identiferTypes.has(name)) {
        typeInfo.type = Array.from(
          new Set([...typeInfo.type, ...identiferTypes.get(name)!.type])
        );
      }

      identiferTypes.set(name, typeInfo);
    }
  }

  analyze() {
    const me = this;

    me.analyzeScope(me.root);

    for (const scope of me.root.scopes) {
      me.analyzeScope(scope);
    }
  }
}

export class TypeManager {
  private types: Map<string, TypeMap>;

  constructor() {
    this.types = new Map();
  }

  analyze(document: TextDocument, chunk: ASTChunkAdvanced): TypeMap {
    const typeMap = new TypeMap(chunk);

    typeMap.analyze();

    const key = document.fileName;
    this.types.set(key, typeMap);

    return typeMap;
  }

  get(document: TextDocument): TypeMap | null {
    const key = document.fileName;

    if (this.types.has(key)) {
      const typeMap = this.types.get(key)!;
      return typeMap;
    }

    return null;
  }
}

export default new TypeManager();
