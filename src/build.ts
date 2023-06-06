import { BuildType, Transpiler } from 'greybel-transpiler';
import vscode, {
  ExtensionContext,
  Position,
  Range,
  TextEditor,
  TextEditorEdit,
  Uri
} from 'vscode';

import { createParseResult } from './build/create-parse-result';
import { createInstaller } from './build/installer';
import { createBasePath } from './helper/create-base-path';
import { TranspilerResourceProvider } from './resource';

export function activate(context: ExtensionContext) {
  async function build(
    editor: TextEditor,
    _edit: TextEditorEdit,
    eventUri: Uri
  ) {
    if (
      editor.document.uri.fsPath === eventUri.fsPath &&
      editor.document.isDirty
    ) {
      const isSaved = await editor.document.save();

      if (!isSaved) {
        vscode.window.showErrorMessage(
          'You cannot build a file which does not exist in the file system.',
          { modal: false }
        );
        return;
      }
    }

    try {
      const config = vscode.workspace.getConfiguration('greybel');
      const target = eventUri.fsPath;
      const buildTypeFromConfig = config.get('transpiler.buildType');
      const environmentVariablesFromConfig =
        config.get<object>('transpiler.environmentVariables') || {};
      const excludedNamespacesFromConfig =
        config.get<string[]>('transpiler.excludedNamespaces') || [];
      const obfuscation = config.get<boolean>('transpiler.obfuscation');
      const ingameDirectory = Uri.file(
        config.get<string>('transpiler.ingameDirectory')
      );
      let buildType = BuildType.DEFAULT;

      if (buildTypeFromConfig === 'Uglify') {
        buildType = BuildType.UGLIFY;
      } else if (buildTypeFromConfig === 'Beautify') {
        buildType = BuildType.BEAUTIFY;
      }

      const result = await new Transpiler({
        target,
        resourceHandler: new TranspilerResourceProvider().getHandler(),
        buildType,
        environmentVariables: new Map(
          Object.entries(environmentVariablesFromConfig)
        ),
        obfuscation,
        disableLiteralsOptimization: config.get('transpiler.dlo'),
        disableNamespacesOptimization: config.get('transpiler.dno'),
        excludedNamespaces: excludedNamespacesFromConfig,
        processImportPathCallback: (path: string) => {
          const relativePath = createBasePath(target, path);
          return Uri.joinPath(ingameDirectory, relativePath).path;
        }
      }).parse();

      const rootPath = vscode.workspace.rootPath
        ? Uri.file(vscode.workspace.rootPath)
        : Uri.joinPath(Uri.file(eventUri.fsPath), '..');
      const buildPath = Uri.joinPath(rootPath, './build');

      try {
        await vscode.workspace.fs.delete(buildPath, { recursive: true });
      } catch (err) {
        console.warn(err);
      }

      await vscode.workspace.fs.createDirectory(buildPath);
      await createParseResult(target, buildPath, result);

      if (config.get('installer')) {
        const maxChars =
          config.get<number>('transpiler.installer.maxChars') || 155000;

        vscode.window.showInformationMessage('Creating installer.', {
          modal: false
        });
        await createInstaller({
          target,
          buildPath: rootPath,
          ingameDirectory: ingameDirectory.path.replace(/\/$/i, ''),
          result,
          maxChars
        });
      }

      vscode.window.showInformationMessage(
        `Build done. Available [here](${buildPath.toString(true)}).`,
        { modal: false }
      );
    } catch (err: any) {
      if (err.range) {
        const errRange = err.range;
        const errTarget = err.target;

        vscode.window
          .showErrorMessage(
            `Build error: ${err.message} at ${errTarget}:${errRange.start}`,
            { modal: false },
            'Go to error'
          )
          .then(async () => {
            const textDocument = await vscode.workspace.openTextDocument(
              errTarget
            );
            const range = new Range(
              new Position(
                errRange.start.line - 1,
                errRange.start.character - 1
              ),
              new Position(errRange.end.line - 1, errRange.end.character - 1)
            );

            vscode.window.showTextDocument(textDocument, {
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
    vscode.commands.registerTextEditorCommand('greybel.build', build)
  );
}
