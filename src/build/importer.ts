import GreybelC2AgentPkg from 'greybel-c2-agent';
import { TranspilerParseResult } from 'greybel-transpiler';
import path from 'path';
import vscode from 'vscode';

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
  mode: string;
}

class Importer {
  private importList: ImportItem[];
  private target: string;
  private ingameDirectory: string;
  private mode: string;

  constructor(options: ImporterOptions) {
    this.target = options.target;
    this.ingameDirectory = options.ingameDirectory;
    this.importList = this.createImportList(options.target, options.result);
    this.mode = options.mode;
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

  async import() {
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
      username: await vscode.window.showInputBox({
        title: 'Enter steam account name',
        ignoreFocusOut: true
      }),
      password: await vscode.window.showInputBox({
        title: 'Enter steam password',
        ignoreFocusOut: true,
        password: true
      })
    });

    for (const item of this.importList) {
      await agent.createFile(
        this.ingameDirectory + path.dirname(item.ingameFilepath),
        path.basename(item.ingameFilepath),
        item.content
      );
    }

    agent.dispose();
  }
}

export const createImporter = async (
  options: ImporterOptions
): Promise<void> => {
  const installer = new Importer(options);
  await installer.import();
};
