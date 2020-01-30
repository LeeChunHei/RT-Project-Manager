import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';

export class ManagerNode implements vscode.TreeDataProvider<Project> {
    private _onDidChangeTreeData: vscode.EventEmitter<Project | undefined> = new vscode.EventEmitter<Project | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Project | undefined> = this._onDidChangeTreeData.event;
    
    refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Project): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Project): Thenable<Project[]> {
        if (vscode.workspace.workspaceFile===undefined){
            return Promise.resolve([new Project('Click to init RT workspace', vscode.TreeItemCollapsibleState.None, undefined)]);
        }else{
            let items: Project[] = [];
            vscode.workspace.workspaceFolders?.forEach(folder=>{
                items.push(new Project(folder.name, vscode.TreeItemCollapsibleState.None, folder.uri));
            });
            return Promise.resolve(items);
        }
	}
}

export class Project extends vscode.TreeItem {

	constructor(
		public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly location?: vscode.Uri
	) {
		super(label, collapsibleState);
	}

	command = {
        title: this.label,
        command: 'rt-project-manager-view.project_item_click',
        tooltip: this.label,
        arguments: [
            this.label,
            this.location,
        ]
    };

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
	};

	contextValue = this.location===undefined?'init_workspace':'project_item';

}