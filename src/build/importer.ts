import GreybelC2AgentPkg from 'greybel-c2-agent';
import { TranspilerParseResult } from 'greybel-transpiler';
import path from 'path';
import vscode, { ExtensionContext } from 'vscode';

import { createBasePath } from '../helper/create-base-path';
const { GreybelC2Agent } = GreybelC2AgentPkg;

const IMPORTER_MODE_MAP = {
  local: 2,
  public: 0,
  nightly: 1
};

type ImportItem = {
  ingameFilepath: string;
  content: string;
};

export interface ImporterOptions {
  target: string;
  ingameDirectory: string;
  result: TranspilerParseResult;
  extensionContext: ExtensionContext;
}

class Importer {
  private importList: ImportItem[];
  private target: string;
  private ingameDirectory: string;
  private mode: string;
  private extensionContext: ExtensionContext;

  constructor(options: ImporterOptions) {
    this.target = options.target;
    this.ingameDirectory = options.ingameDirectory;
    this.importList = this.createImportList(options.target, options.result);
    this.mode = vscode.workspace
      .getConfiguration('greybel')
      .get<string>('createIngame.mode');
    this.extensionContext = options.extensionContext;
  }

  private createImportList(
    rootTarget: string,
    parseResult: TranspilerParseResult
  ): ImportItem[] {
    const imports = Object.entries(parseResult).map(([target, code]) => {
      const ingameFilepath = createBasePath(rootTarget, target, '');

      return {
        ingameFilepath,
        content: code
      };
    });

    return imports;
  }

  private getUsername(): Thenable<string> {
    const username = vscode.workspace
      .getConfiguration('greybel')
      .get<string>('createIngame.steamUser');

    if (username != null) {
      return Promise.resolve(username);
    }

    return vscode.window.showInputBox({
      title: 'Enter steam account name',
      ignoreFocusOut: true
    });
  }

  private async getPassword(): Promise<string> {
    let password = await this.extensionContext.secrets.get(
      'greybel.createIngame.steamPassword'
    );

    if (password != null) {
      return password;
    }

    password = await vscode.window.showInputBox({
      title: 'Enter steam password',
      ignoreFocusOut: true,
      password: true
    });

    this.extensionContext.secrets.store(
      'greybel.createIngame.steamPassword',
      password
    );

    return password;
  }

  async import(): Promise<boolean> {
    if (!Object.prototype.hasOwnProperty.call(IMPORTER_MODE_MAP, this.mode)) {
      throw new Error('Unknown import mode.');
    }

    const agent = new GreybelC2Agent({
      connectionType: IMPORTER_MODE_MAP[this.mode],
      steamGuardGetter: async (domain, callback) => {
        const code = await vscode.window.showInputBox({
          title: `Enter steam guard code (send to ${domain})`,
          ignoreFocusOut: true,
          password: true
        });
        callback(code);
      },
      username: await this.getUsername(),
      password: await this.getPassword()
    });
    let success = false;

    for (const item of this.importList) {
      const isFileCreated = await agent.tryToCreateFile(
        this.ingameDirectory + path.dirname(item.ingameFilepath),
        path.basename(item.ingameFilepath),
        item.content
      );

      if (!isFileCreated) {
        success = false;
        break;
      }
    }

    agent.dispose();

    return success;
  }
}

export const createImporter = async (
  options: ImporterOptions
): Promise<boolean> => {
  const installer = new Importer(options);
  return installer.import();
};
