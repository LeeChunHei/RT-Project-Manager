// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as util from 'util';
import * as os from 'os';
import * as path from 'path';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('on');
	process.chdir(context.extensionPath);
	let create_project_panel: vscode.WebviewPanel | undefined = undefined;
	let properties_panel: vscode.WebviewPanel | undefined = undefined;

	vscode.workspace.onDidOpenTextDocument((doc: vscode.TextDocument) => {
		if (doc.fileName.indexOf('.h') !== -1 && doc.uri.scheme === "file") {
			if (fs.readFileSync(doc.uri.fsPath, 'utf8') === '') {
				if (doc.uri.fsPath) {
					let temp = doc.uri.fsPath.split('\\').pop();
					if (temp) {
						let file_name = String(temp.split('/').pop()).replace('.', '_').toUpperCase();
						fs.writeFileSync(doc.uri.fsPath, '#ifndef ' + file_name + '\n#define ' + file_name + '\n\n\n\n#endif');
					}
				}
			}
		}
	});

	context.subscriptions.push(vscode.commands.registerCommand('rt-project-manager.create_project', () => {
		if (create_project_panel) {
			create_project_panel.reveal(vscode.ViewColumn.One);
		} else {
			create_project_panel = vscode.window.createWebviewPanel(
				'create_project',
				'Create Project',
				vscode.ViewColumn.One,
				{
					enableScripts: true
				}
			);
			create_project_panel.webview.html = getWebviewContent('create_project.html');
			create_project_panel.webview.postMessage({
				command: 'init',
				items: JSON.parse(fs.readFileSync(path.join(context.extensionPath, 'public', 'webview', 'create_project.json'), 'utf8')),
				flash_size: context.workspaceState.get('flash_size') ? context.workspaceState.get('flash_size') : '33554432',
				ram_size: context.workspaceState.get('ram_size') ? context.workspaceState.get('ram_size') : '33554432',
				workspace_path: context.workspaceState.get('workspacePath') ? context.workspaceState.get('workspacePath') : '',
				rtlib_path: context.workspaceState.get('rtlibPath') ? context.workspaceState.get('rtlibPath') : '',
				make_path: context.workspaceState.get('make') ? context.workspaceState.get('make') : '',
				toolchain_path: vscode.workspace.getConfiguration().get<string>('cortex-debug.armToolchainPath')
			});
			create_project_panel.webview.onDidReceiveMessage(
				message => {
					switch (message.command) {
						case 'project_setting':
							let form_ok = true;
							if (!message.project_name) {
								vscode.window.showErrorMessage('Project name cannot be empty');
								form_ok = false;
							}
							if (!message.config_name) {
								vscode.window.showErrorMessage('Config cannot be empty');
								form_ok = false;
							}
							if (!message.flash_size) {
								vscode.window.showErrorMessage('Flash size cannot be empty');
								form_ok = false;
							}
							if (!message.ram_size) {
								vscode.window.showErrorMessage('Ram size cannot be empty');
								form_ok = false;
							}
							if (!message.workspace_path) {
								vscode.window.showErrorMessage('Workspace path cannot be empty');
								form_ok = false;
							}
							if (!message.rtlib_path) {
								vscode.window.showErrorMessage('RTLib path cannot be empty');
								form_ok = false;
							}
							if (!message.make_path) {
								vscode.window.showErrorMessage('Make path cannot be empty');
								form_ok = false;
							}
							if (!message.toolchain_path) {
								vscode.window.showErrorMessage('Toolchain path cannot be empty');
								form_ok = false;
							}
							if (fs.existsSync(message.workspace_path + '/' + message.project_name)) {
								vscode.window.showErrorMessage('Folder with same project name exists');
								form_ok = false;
							}
							if (!fs.existsSync(message.rtlib_path + '/' + 'inc') || !fs.existsSync(message.rtlib_path + '/' + 'src')) {
								vscode.window.showErrorMessage('RTLib path is not correct');
								form_ok = false;
							}
							if (form_ok && create_project_panel) {
								context.workspaceState.update('flash_size', Number(message.flash_size));
								context.workspaceState.update('ram_size', Number(message.ram_size));
								context.workspaceState.update('workspacePath', message.workspace_path);
								context.workspaceState.update('rtlibPath', message.rtlib_path);
								context.workspaceState.update('make', message.make_path);
								vscode.workspace.getConfiguration().update('cortex-debug.armToolchainPath', message.toolchain_path, vscode.ConfigurationTarget.Workspace);
								const project_path = message.workspace_path + '/' + message.project_name
								fs.mkdirSync(project_path);
								fs.mkdirSync(project_path + '/.vscode');
								fs.mkdirSync(project_path + '/inc');
								fs.mkdirSync(project_path + '/src');
								fs.mkdirSync(project_path + '/build');
								fs.symlinkSync(message.rtlib_path + '/inc/device_driver', project_path + '/inc/device_driver', 'junction');
								fs.symlinkSync(message.rtlib_path + '/inc/driver', project_path + '/inc/driver', 'junction');
								fs.symlinkSync(message.rtlib_path + '/inc/system', project_path + '/inc/system', 'junction');
								fs.symlinkSync(message.rtlib_path + '/src/device_driver', project_path + '/src/device_driver', 'junction');
								fs.symlinkSync(message.rtlib_path + '/src/driver', project_path + '/src/driver', 'junction');
								fs.symlinkSync(message.rtlib_path + '/src/system', project_path + '/src/system', 'junction');
								fs.symlinkSync(message.rtlib_path + '/config', project_path + '/config', 'junction');
								const is_xip = message.xip == 'xip';
								let xip_linker;
								if (is_xip) {
									xip_linker = 'MIMXRT1052_XIP';
								} else {
									xip_linker = 'MIMXRT1052_nonXIP';
								}
								const makefile_template = fs.readFileSync('./template/makefile', 'utf8');
								fs.writeFileSync(project_path + '/makefile',
									util.format(makefile_template,
										message.project_name,
										message.config_name,
										is_xip ? '-DHAVE_XIP' : '',
										message.rtlib_path + '/inc',
										message.op_level,
										message.debug_level,
										xip_linker,
										message.toolchain_path
									)
								);
								const launch_template = fs.readFileSync('./template/launch.json', 'utf8');
								fs.writeFileSync(project_path + '/.vscode/launch.json',
									util.format(launch_template,
										message.project_name
									)
								);
								const tasks_template = fs.readFileSync('./template/tasks.json', 'utf8');
								fs.writeFileSync(project_path + '/.vscode/tasks.json',
									util.format(tasks_template,
										os.platform() === 'win32' ? "& '" + message.make_path + "'" : message.make_path
									)
								);
								const c_cpp_properties_template = fs.readFileSync('./template/c_cpp_properties.json', 'utf8');
								fs.writeFileSync(project_path + '/.vscode/c_cpp_properties.json',
									util.format(c_cpp_properties_template,
										message.project_name,
										message.config_name,
										'RT1052',
										is_xip ? 'HAVE_XIP' : '',
										message.toolchain_path + '/arm-none-eabi-g++'
									)
								);
								const non_xip_ld = fs.readFileSync('./template/build/MIMXRT1052_nonXIP.ld', 'utf8');
								fs.writeFileSync(project_path + '/build/MIMXRT1052_nonXIP.ld',
									util.format(non_xip_ld,
										message.flash_size,
										message.ram_size,
										message.ram_size,
										message.ram_size
									)
								);
								const xip_ld = fs.readFileSync('./template/build/MIMXRT1052_XIP.ld', 'utf8');
								fs.writeFileSync(project_path + '/build/MIMXRT1052_XIP.ld',
									util.format(xip_ld,
										message.flash_size,
										message.ram_size,
										message.ram_size,
										message.ram_size
									)
								);
								if (message.project_template == 'empty') {
									fs.copyFileSync('./template/src/main.cpp', project_path + '/src/main.cpp');
								} else if (message.project_template == 'blinky') {
									fs.copyFileSync('./template/src/blinky_main.cpp', project_path + '/src/main.cpp');
								}
								const folder_uri = vscode.Uri.file(project_path);
								vscode.workspace.updateWorkspaceFolders(
									vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0,
									null,
									{
										uri: folder_uri
									}
								);
								create_project_panel.dispose();
							}
							break;
						case 'open_folder_dialog':
							vscode.window.showOpenDialog({
								canSelectMany: false,
								canSelectFolders: true,
								canSelectFiles: false
							}).then(uri => {
								if (uri) {
									console.log(uri[0].fsPath);
								}
							});
					}
					return;
				},
				undefined,
				context.subscriptions
			);
			create_project_panel.webview.postMessage({
				command: 'init',
				flash_size: context.workspaceState.get('flash_size') ? context.workspaceState.get('flash_size') : '33554432',
				ram_size: context.workspaceState.get('ram_size') ? context.workspaceState.get('ram_size') : '33554432',
				workspace_path: context.workspaceState.get('workspacePath') ? context.workspaceState.get('workspacePath') : '',
				rtlib_path: context.workspaceState.get('rtlibPath') ? context.workspaceState.get('rtlibPath') : '',
				make_path: context.workspaceState.get('make') ? context.workspaceState.get('make') : '',
				toolchain_path: vscode.workspace.getConfiguration().get<string>('cortex-debug.armToolchainPath')
			});
			create_project_panel.onDidDispose(
				() => {
					create_project_panel = undefined;
				},
				null,
				context.subscriptions
			);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('rt-project-manager.init_workspace', () => {
		const options: vscode.SaveDialogOptions = {
			filters: {
				'VSCode Workspace': ['code-workspace']
			}
		};
		vscode.window.showSaveDialog(options).then(uri => {
			if (uri) {
				fs.writeFileSync(uri.fsPath, '{\n"folders": []\n}');
				vscode.commands.executeCommand('vscode.openFolder', uri);
			}
		});
	}));

	// context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }

function getWebviewContent(webview_name: string) {
	return fs.readFileSync(path.join('./public', 'webview', webview_name), 'utf8');
}