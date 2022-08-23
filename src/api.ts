import vscode, {
  ExtensionContext,
  TextEditor,
  TextEditorEdit,
  Uri
} from 'vscode';

export function activate(context: ExtensionContext) {
  async function api(_editor: TextEditor, _edit: TextEditorEdit, _args: any[]) {
    const panel = vscode.window.createWebviewPanel(
      'greyScriptAPI',
      'GreyScript API',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [Uri.file(context.extensionPath)]
      }
    );

    const indexStylesheet = Uri.file(
      Uri.joinPath(Uri.file(context.extensionPath), 'api.view.css').fsPath
    );
    const indexScript = Uri.file(
      Uri.joinPath(Uri.file(context.extensionPath), 'api.view.js').fsPath
    );

    panel.webview.html = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
          <meta http-equiv="content-type" content="text/html; charset=UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="Content-Security-Policy" content="default-src * self blob: data: gap:; style-src * self 'unsafe-inline' blob: data: gap:; script-src * 'self' 'unsafe-eval' 'unsafe-inline' blob: data: gap:; object-src * 'self' blob: data: gap:; img-src * self 'unsafe-inline' blob: data: gap:; connect-src self * 'unsafe-inline' blob: data: gap:; frame-src * self blob: data: gap:;">
          <title>GreyScript API</title>
          <link rel="stylesheet" type="text/css" href="${panel.webview.asWebviewUri(
            indexStylesheet
          )}">
        <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
        <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
      </head>
      <body>
        <div id="root">
          
        </div>
        <footer>
          <script src="${panel.webview.asWebviewUri(indexScript)}"></script>
        </footer>
      </body>
    </html>`;
  }

  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand('greybel.api', api)
  );
}
