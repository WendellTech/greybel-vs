import { BuildType, DirectTranspiler } from 'greybel-transpiler';
import vscode, {
  ExtensionContext,
  Position,
  Range,
  TextEditor,
  TextEditorEdit
} from 'vscode';

export enum ShareType {
  WRITE = 'write',
  CLIPBOARD = 'clipboard'
}

export function activate(context: ExtensionContext) {
  async function transform(
    editor: TextEditor,
    editBuilder: TextEditorEdit,
    _args: any[],
    specificBuildType?: BuildType,
    shareType: ShareType = ShareType.WRITE
  ) {
    if (editor.document.isDirty) {
      const isSaved = await editor.document.save();

      if (!isSaved) {
        vscode.window.showErrorMessage(
          'You cannot transform a file which does not exist in the file system.',
          { modal: false }
        );
        return;
      }
    }

    try {
      const config = vscode.workspace.getConfiguration('greybel');
      const buildTypeFromConfig = config.get('transpiler.buildType');
      const environmentVariablesFromConfig =
        config.get<object>('transpiler.environmentVariables') || {};
      const excludedNamespacesFromConfig =
        config.get<string[]>('transpiler.excludedNamespaces') || [];
      const obfuscation = config.get<boolean>('transpiler.obfuscation');
      let buildType = BuildType.DEFAULT;

      if (buildTypeFromConfig === 'Uglify') {
        buildType = BuildType.UGLIFY;
      } else if (buildTypeFromConfig === 'Beautify') {
        buildType = BuildType.BEAUTIFY;
      }

      const result = new DirectTranspiler({
        code: editor.document.getText(),
        buildType: specificBuildType || buildType,
        environmentVariables: new Map(
          Object.entries(environmentVariablesFromConfig)
        ),
        obfuscation,
        disableLiteralsOptimization: config.get('transpiler.dlo'),
        disableNamespacesOptimization: config.get('transpiler.dno'),
        excludedNamespaces: excludedNamespacesFromConfig
      }).parse();

      switch (shareType) {
        case ShareType.WRITE: {
          const firstLine = editor.document.lineAt(0);
          const lastLine = editor.document.lineAt(
            editor.document.lineCount - 1
          );
          const textRange = new Range(
            firstLine.range.start,
            lastLine.range.end
          );

          editBuilder.replace(textRange, result);
          vscode.window.showInformationMessage('Transform done.', {
            modal: false
          });
          break;
        }
        case ShareType.CLIPBOARD: {
          vscode.env.clipboard.writeText(result);
          vscode.window.showInformationMessage(
            'Transform copied to clipboard.',
            { modal: false }
          );
          break;
        }
        default: {
          vscode.window.showInformationMessage('Unknown share type.', {
            modal: false
          });
        }
      }
    } catch (err: any) {
      if (err.range) {
        const errRange = err.range;

        vscode.window
          .showErrorMessage(
            `Build error: ${err.message} at ${editor.document.uri.fsPath}:${errRange}`,
            { modal: false },
            'Go to error'
          )
          .then(() => {
            const range = new Range(
              new Position(
                errRange.start.line - 1,
                errRange.start.character - 1
              ),
              new Position(errRange.end.line - 1, errRange.end.character - 1)
            );

            vscode.window.showTextDocument(editor.document, {
              selection: range
            });
          });
      } else {
        vscode.window.showErrorMessage(
          `Unexpected error: ${err.message}\n${err.stack}`,
          { modal: false }
        );
      }
    }
  }

  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      'greybel.transform.clipboard',
      (editor: TextEditor, edit: TextEditorEdit, args: any[]) =>
        transform(editor, edit, args, BuildType.UGLIFY, ShareType.CLIPBOARD)
    ),
    vscode.commands.registerTextEditorCommand(
      'greybel.transform.write',
      transform
    ),
    vscode.commands.registerTextEditorCommand(
      'greybel.minify.write',
      (editor: TextEditor, edit: TextEditorEdit, args: any[]) =>
        transform(editor, edit, args, BuildType.UGLIFY)
    ),
    vscode.commands.registerTextEditorCommand(
      'greybel.beautify.write',
      (editor: TextEditor, edit: TextEditorEdit, args: any[]) =>
        transform(editor, edit, args, BuildType.BEAUTIFY)
    )
  );
}
