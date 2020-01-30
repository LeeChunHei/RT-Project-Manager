import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from "fs";
import * as util from 'util';
import * as os from 'os';

export class ProjectPanel {
    public static extension_context: vscode.ExtensionContext;
    public static exist_panel?: ProjectPanel[];
    private panel: vscode.WebviewPanel;

    private constructor(panel: vscode.WebviewPanel) {
        this.panel = panel;
    }

    private static openPanel(panel_name: string, panel_type: string) {
        if (ProjectPanel.exist_panel === undefined) {
            ProjectPanel.exist_panel = [];
        }
        for (let project_panel of ProjectPanel.exist_panel) {
            if (project_panel.panel.title === panel_name && project_panel.panel.viewType === panel_type) {
                project_panel.panel.reveal(vscode.ViewColumn.One);
                return undefined;
            }
        }
        const panel = vscode.window.createWebviewPanel(
            panel_type,
            panel_name,
            vscode.ViewColumn.One,
            {
                // Enable javascript in the webview
                enableScripts: true,
                // And restrict the webview to only loading content from our extension's `media` directory.
                localResourceRoots: [vscode.Uri.file(path.join(ProjectPanel.extension_context.extensionPath, 'media')), vscode.Uri.file(path.join(ProjectPanel.extension_context.extensionPath, 'resources'))],
                retainContextWhenHidden: true
            }
        );
        panel.onDidDispose(() => {
            ProjectPanel.exist_panel?.every((project_panel, index) => {
                if (project_panel.panel === panel) {
                    ProjectPanel.exist_panel?.splice(index, 1);
                    return false;
                }
            });
            console.log('delete');
        }, undefined, ProjectPanel.extension_context.subscriptions);
        ProjectPanel.exist_panel.push(new ProjectPanel(panel));
        return ProjectPanel.exist_panel[ProjectPanel.exist_panel.length - 1].panel;
    }

    public static create_project_panel() {
        let _panel = ProjectPanel.openPanel('Create Project', 'create_project');
        let data = fs.readFileSync(path.join(ProjectPanel.extension_context.extensionPath, 'resources', 'create_project.html'), 'utf-8');
        let workspace_config = vscode.workspace.getConfiguration('rt-project-manager');
        if (_panel !== undefined) {
            _panel.webview.html = data;
            _panel.webview.onDidReceiveMessage(
                (message) => {
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
                            if (!message.project_path) {
                                vscode.window.showErrorMessage('Project path cannot be empty');
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
                            if (fs.existsSync(message.project_path + '/' + message.project_name)) {
                                vscode.window.showErrorMessage('Folder with same project name exists');
                                form_ok = false;
                            }
                            if (!fs.existsSync(message.rtlib_path + '/' + 'inc') || !fs.existsSync(message.rtlib_path + '/' + 'src')) {
                                vscode.window.showErrorMessage('RTLib path is not correct');
                                form_ok = false;
                            }
                            if (form_ok && _panel) {
                                workspace_config.update('flash_size', Number(message.flash_size));
                                workspace_config.update('ram_size', Number(message.ram_size));
                                workspace_config.update('rtlibPath', message.rtlib_path);
                                workspace_config.update('make', message.make_path);
                                vscode.workspace.getConfiguration().update('cortex-debug.armToolchainPath', message.toolchain_path, vscode.ConfigurationTarget.Workspace);
                                const project_path = path.join(message.project_path, message.project_name);
                                fs.mkdirSync(project_path);
                                fs.mkdirSync(path.join(project_path, '.vscode'));
                                fs.mkdirSync(path.join(project_path, 'inc'));
                                fs.mkdirSync(path.join(project_path, 'src'));
                                fs.mkdirSync(path.join(project_path, 'build'));
                                const is_xip = message.xip === 'xip';
                                let xip_linker;
                                if (is_xip) {
                                    xip_linker = 'MIMXRT1052_XIP';
                                } else {
                                    xip_linker = 'MIMXRT1052_nonXIP';
                                }
                                const makefile_template = fs.readFileSync(path.join(ProjectPanel.extension_context.extensionPath, 'template', 'makefile'), 'utf8');
                                fs.writeFileSync(path.join(project_path, 'makefile'),
                                    util.format(makefile_template,
                                        message.project_name,
                                        message.config_name,
                                        is_xip ? '-DHAVE_XIP' : '',
                                        path.join(message.rtlib_path, 'inc'),
                                        message.op_level,
                                        message.debug_level,
                                        xip_linker,
                                        message.toolchain_path
                                    )
                                );
                                const launch_template = fs.readFileSync(path.join(ProjectPanel.extension_context.extensionPath, 'template', 'launch.json'), 'utf8');
                                fs.writeFileSync(project_path + '/.vscode/launch.json',
                                    util.format(launch_template,
                                        message.project_name
                                    )
                                );
                                const tasks_template = fs.readFileSync(path.join(ProjectPanel.extension_context.extensionPath, 'template', 'tasks.json'), 'utf8');
                                fs.writeFileSync(project_path + '/.vscode/tasks.json',
                                    util.format(tasks_template,
                                        os.platform() === 'win32' ? "& '" + message.make_path + "'" : message.make_path
                                    )
                                );
                                const c_cpp_properties_template = fs.readFileSync(path.join(ProjectPanel.extension_context.extensionPath, 'template', 'c_cpp_properties.json'), 'utf8');
                                fs.writeFileSync(project_path + '/.vscode/c_cpp_properties.json',
                                    util.format(c_cpp_properties_template,
                                        message.project_name,
                                        message.config_name,
                                        'RT1052',
                                        is_xip ? 'HAVE_XIP' : '',
                                        message.toolchain_path + '/arm-none-eabi-g++'
                                    )
                                );
                                const non_xip_ld = fs.readFileSync(path.join(ProjectPanel.extension_context.extensionPath, 'template', 'build', 'MIMXRT1052_nonXIP.ld'), 'utf8');
                                fs.writeFileSync(project_path + '/build/MIMXRT1052_nonXIP.ld',
                                    util.format(non_xip_ld,
                                        message.flash_size,
                                        message.ram_size,
                                        message.ram_size,
                                        message.ram_size
                                    )
                                );
                                const xip_ld = fs.readFileSync(path.join(ProjectPanel.extension_context.extensionPath, 'template', 'build', 'MIMXRT1052_XIP.ld'), 'utf8');
                                fs.writeFileSync(project_path + '/build/MIMXRT1052_XIP.ld',
                                    util.format(xip_ld,
                                        message.flash_size,
                                        message.ram_size,
                                        message.ram_size,
                                        message.ram_size
                                    )
                                );
                                if (message.project_template === 'empty') {
                                    fs.copyFileSync(path.join(ProjectPanel.extension_context.extensionPath, 'template', 'src', 'main.cpp'), project_path + '/src/main.cpp');
                                } else if (message.project_template === 'blinky') {
                                    fs.copyFileSync(path.join(ProjectPanel.extension_context.extensionPath, 'template', 'src', 'blinky_main.cpp'), project_path + '/src/main.cpp');
                                }
                                const folder_uri = vscode.Uri.file(project_path);
                                vscode.workspace.updateWorkspaceFolders(
                                    vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0,
                                    null,
                                    {
                                        uri: folder_uri
                                    }
                                );
                                _panel.dispose();
                            }
                            break;
                    }
                    return;
                }, undefined, ProjectPanel.extension_context.subscriptions);
            _panel.webview.postMessage({
                command: 'init',
                flash_size: workspace_config.get('flash_size') ? workspace_config.get('flash_size') : '33554432',
                ram_size: workspace_config.get('ram_size') ? workspace_config.get('ram_size') : '33554432',
                project_path: vscode.workspace.workspaceFile?.fsPath ? path.dirname(vscode.workspace.workspaceFile?.fsPath) : '',
                rtlib_path: workspace_config.get('rtlibPath') ? workspace_config.get('rtlibPath') : '',
                make_path: workspace_config.get('make') ? workspace_config.get('make') : '',
                toolchain_path: vscode.workspace.getConfiguration('cortex-debug').get('armToolchainPath')
            });
        }
    }

    public static project_property_panel(project_name: string, project_location: vscode.Uri) {
        let _panel = ProjectPanel.openPanel('Property: ' + project_name, 'property');
        let data = fs.readFileSync(path.join(ProjectPanel.extension_context.extensionPath, 'resources', 'property.html'), 'utf-8');
        let workspace_config = vscode.workspace.getConfiguration('rt-project-manager');
        let project_path = project_location.fsPath;
        if (_panel !== undefined) {
            _panel.webview.html = data;
            const makefile = fs.readFileSync(project_path + '/makefile', 'utf8');
            const linker = fs.readFileSync(project_path + '/build/MIMXRT1052_nonXIP.ld', 'utf8');
            let _config = makefile.match(/(?<=CONFIG=).*/);
            let _xip = makefile.match(/(?<=XIP_MACRO=).*/);
            let flash = linker.match(/(?<=ORIGIN = 0x60000000, LENGTH = ).*/);
            let ram = linker.match(/(?<=0x80000000, LENGTH = ).*/);
            let op = makefile.match(/(?<=OP_FLAG=).*/);
            let debug = makefile.match(/(?<=DEBUG_FLAG=).*/);
            _panel.webview.onDidReceiveMessage(
                (message) => {
                    switch (message.command) {
                        case 'save':
                            let form_ok = true;
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
                            if (form_ok && _panel) {
                                const is_xip = message.xip === 'xip';
                                let xip_linker;
                                if (is_xip) {
                                    xip_linker = 'MIMXRT1052_XIP';
                                } else {
                                    xip_linker = 'MIMXRT1052_nonXIP';
                                }
                                fs.writeFileSync(project_path + '/makefile',
                                    fs.readFileSync(project_path + '/makefile', 'utf8')
                                        .replace(_config ? _config[0] : '', message.config_name)
                                        .replace('XIP_MACRO=' + (is_xip ? '\n' : '-DHAVE_XIP\n'), 'XIP_MACRO=' + (is_xip ? '-DHAVE_XIP\n' : '\n'))
                                        .replace(is_xip ? 'MIMXRT1052_nonXIP' : 'MIMXRT1052_XIP', xip_linker)
                                        .replace(op ? op[0] : '', message.op_level)
                                        .replace(debug ? debug[0] : '', message.debug_level)
                                );
                                fs.writeFileSync(project_path + '/.vscode/c_cpp_properties.json',
                                    fs.readFileSync(project_path + '/.vscode/c_cpp_properties.json', 'utf8')
                                        .replace((_config ? _config[0] : ''), message.config_name)
                                        .replace((is_xip ? '""' : '"HAVE_XIP"'), (is_xip ? '"HAVE_XIP"' : '""'))
                                );
                                fs.writeFileSync(project_path + '/build/MIMXRT1052_nonXIP.ld',
                                    fs.readFileSync(project_path + '/build/MIMXRT1052_nonXIP.ld', 'utf8')
                                        .replace('ORIGIN = 0x60000000, LENGTH = ' + (flash ? flash[0] : ''), 'ORIGIN = 0x60000000, LENGTH = ' + message.flash_size)
                                        .replace('ORIGIN = 0x80000000, LENGTH = ' + (ram ? ram[0].substr(0, ram[0].length - 4) : ''), 'ORIGIN = 0x80000000, LENGTH = ' + message.ram_size)
                                        .replace('ORIGIN = 0x80000000 + ( ' + (ram ? ram[0].substr(0, ram[0].length - 4) : ''), 'ORIGIN = 0x80000000 + ( ' + message.ram_size)
                                        .replace(' / 2 ), LENGTH = ' + (ram ? ram[0].substr(0, ram[0].length - 4) : ''), ' / 2 ), LENGTH = ' + message.ram_size)
                                );
                                fs.writeFileSync(project_path + '/build/MIMXRT1052_XIP.ld',
                                    fs.readFileSync(project_path + '/build/MIMXRT1052_XIP.ld', 'utf8')
                                        .replace('ORIGIN = 0x60002400, LENGTH = ' + (flash ? flash[0] : ''), 'ORIGIN = 0x60002400, LENGTH = ' + message.flash_size)
                                        .replace('ORIGIN = 0x80000000 + ( ' + (ram ? ram[0].substr(0, ram[0].length - 4) : ''), 'ORIGIN = 0x80000000 + ( ' + message.ram_size)
                                        .replace(' / 2 ), LENGTH = ' + (ram ? ram[0].substr(0, ram[0].length - 4) : ''), ' / 2 ), LENGTH = ' + message.ram_size)
                                        .replace('ORIGIN = 0x80000000, LENGTH = ' + (ram ? ram[0].substr(0, ram[0].length - 4) : ''), 'ORIGIN = 0x80000000, LENGTH = ' + message.ram_size)
                                );
                                _panel.dispose();
                            }
                            break;
                        case 'cancel':
                            if (_panel) {
                                _panel.dispose();
                            }
                            break;
                    }
                    return;
                },
                undefined,
                ProjectPanel.extension_context.subscriptions
            );
            _panel.webview.postMessage({
                command: 'init',
                config_name: _config ? _config[0] : '',
                xip: _xip ? (_xip[0] === '-DHAVE_XIP' ? 'xip' : 'non_xip') : 'non_xip',
                flash_size: flash ? Number(flash[0]) : 0,
                ram_size: ram ? Number(ram[0].substr(0, ram[0].length - 4)) : 0,
                op_level: op ? op[0] : '',
                debug_level: debug ? debug[0] : ''
            });
        }
    }
}

// context.subscriptions.push(vscode.commands.registerCommand('explorer.properties', (selected) => {
//     let project_path = selected ? ((os.platform() === 'win32') ? selected.fsPath : selected.path) : '';
//     if (properties_panel) {
//         properties_panel.reveal(vscode.ViewColumn.One);
//     } else {
//         properties_panel = vscode.window.createWebviewPanel(
//             'properties',
//             'Properties',
//             vscode.ViewColumn.One,
//             {
//                 enableScripts: true
//             }
//         );
//         const makefile = fs.readFileSync(project_path + '/makefile', 'utf8');
//         const linker = fs.readFileSync(project_path + '/build/MIMXRT1052_nonXIP.ld', 'utf8');
//         let _config = makefile.match(/(?<=CONFIG=).*/);
//         let _xip = makefile.match(/(?<=XIP_MACRO=).*/);
//         let flash = linker.match(/(?<=ORIGIN = 0x60000000, LENGTH = ).*/);
//         let ram = linker.match(/(?<=0x80000000, LENGTH = ).*/);
//         let op = makefile.match(/(?<=OP_FLAG=).*/);
//         let debug = makefile.match(/(?<=DEBUG_FLAG=).*/);
//         properties_panel.webview.html = getWebviewContent('properties');
//         properties_panel.webview.onDidReceiveMessage(
//             message => {
//                 switch (message.command) {
//                     case 'save':
//                         let form_ok = true;
//                         if (!message.config_name) {
//                             vscode.window.showErrorMessage('Config cannot be empty');
//                             form_ok = false;
//                         }
//                         if (!message.flash_size) {
//                             vscode.window.showErrorMessage('Flash size cannot be empty');
//                             form_ok = false;
//                         }
//                         if (!message.ram_size) {
//                             vscode.window.showErrorMessage('Ram size cannot be empty');
//                             form_ok = false;
//                         }
//                         if (form_ok && properties_panel) {
//                             const is_xip = message.xip == 'xip';
//                             let xip_linker;
//                             if (is_xip) {
//                                 xip_linker = 'MIMXRT1052_XIP';
//                             } else {
//                                 xip_linker = 'MIMXRT1052_nonXIP';
//                             }
//                             fs.writeFileSync(project_path + '/makefile',
//                                 fs.readFileSync(project_path + '/makefile', 'utf8')
//                                     .replace(_config ? _config[0] : '', message.config_name)
//                                     .replace('XIP_MACRO=' + (is_xip ? '\n' : '-DHAVE_XIP\n'), 'XIP_MACRO=' + (is_xip ? '-DHAVE_XIP\n' : '\n'))
//                                     .replace(is_xip ? 'MIMXRT1052_nonXIP' : 'MIMXRT1052_XIP', xip_linker)
//                                     .replace(op ? op[0] : '', message.op_level)
//                                     .replace(debug ? debug[0] : '', message.debug_level)
//                             );
//                             fs.writeFileSync(project_path + '/.vscode/c_cpp_properties.json',
//                                 fs.readFileSync(project_path + '/.vscode/c_cpp_properties.json', 'utf8')
//                                     .replace((_config ? _config[0] : ''), message.config_name)
//                                     .replace((is_xip ? '""' : '"HAVE_XIP"'), (is_xip ? '"HAVE_XIP"' : '""'))
//                             );
//                             fs.writeFileSync(project_path + '/build/MIMXRT1052_nonXIP.ld',
//                                 fs.readFileSync(project_path + '/build/MIMXRT1052_nonXIP.ld', 'utf8')
//                                     .replace('ORIGIN = 0x60000000, LENGTH = ' + (flash ? flash[0] : ''), 'ORIGIN = 0x60000000, LENGTH = ' + message.flash_size)
//                                     .replace('ORIGIN = 0x80000000, LENGTH = ' + (ram ? ram[0].substr(0, ram[0].length - 4) : ''), 'ORIGIN = 0x80000000, LENGTH = ' + message.ram_size)
//                                     .replace('ORIGIN = 0x80000000 + ( ' + (ram ? ram[0].substr(0, ram[0].length - 4) : ''), 'ORIGIN = 0x80000000 + ( ' + message.ram_size)
//                                     .replace(' / 2 ), LENGTH = ' + (ram ? ram[0].substr(0, ram[0].length - 4) : ''), ' / 2 ), LENGTH = ' + message.ram_size)
//                             );
//                             fs.writeFileSync(project_path + '/build/MIMXRT1052_XIP.ld',
//                                 fs.readFileSync(project_path + '/build/MIMXRT1052_XIP.ld', 'utf8')
//                                     .replace('ORIGIN = 0x60002400, LENGTH = ' + (flash ? flash[0] : ''), 'ORIGIN = 0x60002400, LENGTH = ' + message.flash_size)
//                                     .replace('ORIGIN = 0x80000000 + ( ' + (ram ? ram[0].substr(0, ram[0].length - 4) : ''), 'ORIGIN = 0x80000000 + ( ' + message.ram_size)
//                                     .replace(' / 2 ), LENGTH = ' + (ram ? ram[0].substr(0, ram[0].length - 4) : ''), ' / 2 ), LENGTH = ' + message.ram_size)
//                                     .replace('ORIGIN = 0x80000000, LENGTH = ' + (ram ? ram[0].substr(0, ram[0].length - 4) : ''), 'ORIGIN = 0x80000000, LENGTH = ' + message.ram_size)
//                             );
//                             properties_panel.dispose();
//                         }
//                         break;
//                     case 'cancel':
//                         if (properties_panel) {
//                             properties_panel.dispose();
//                         }
//                         break;
//                 }
//                 return;
//             },
//             undefined,
//             context.subscriptions
//         );
//         properties_panel.webview.postMessage({
//             command: 'init',
//             config_name: _config ? _config[0] : '',
//             xip: _xip ? (_xip[0] == '-DHAVE_XIP' ? 'xip' : 'non_xip') : 'non_xip',
//             flash_size: flash ? Number(flash[0]) : 0,
//             ram_size: ram ? Number(ram[0].substr(0, ram[0].length - 4)) : 0,
//             op_level: op ? op[0] : '',
//             debug_level: debug ? debug[0] : ''
//         });
//         properties_panel.onDidDispose(
//             () => {
//                 properties_panel = undefined;
//             },
//             null,
//             context.subscriptions
//         );
//     }
// }));

// function getWebviewContent(call: string) {
//     switch (call) {
//         case 'create_project':
//             return `<!DOCTYPE html>
// 	<html>

// 	<head>
// 		<meta name="viewport" content="width=device-width, initial-scale=1">
// 		<style>
// 			* {
// 				box-sizing: border-box
// 			}

// 			body {
// 				font-family: "Lato", sans-serif;
// 				background: #252526;
// 				color: #FFFFFF;
// 			}
// 			/* Style the tab */

// 			.tab {
// 				float: left;
// 				border: 1px solid #ccc;
// 				background-color: var(background);
// 				width: 20%;
// 				height: 100%;
// 			}
// 			/* Style the buttons inside the tab */

// 			.tab button {
// 				display: block;
// 				background-color: inherit;
// 				color: #FFFFFF;
// 				padding: 22px 16px;
// 				width: 100%;
// 				border: none;
// 				outline: none;
// 				text-align: left;
// 				cursor: pointer;
// 				transition: 0.3s;
// 				font-size: 17px;
// 			}
// 			/* Change background color of buttons on hover */

// 			.tab button:hover {
// 				background-color: #ddd;
// 				color: black;
// 			}
// 			/* Create an active/current "tab button" class */

// 			.tab button.active {
// 				background-color: #ccc;
// 				color: black
// 			}
// 			/* Style the tab content */

// 			.tabcontent {
// 				float: left;
// 				padding: 12px 12px;
// 				border: 1px solid #ccc;
// 				width: 80%;
// 				height: 100%;
// 			}

// 			input {
// 				width: 100%;
// 				padding: 12px 20px;
// 				margin: 8px 0;
// 				display: inline-block;
// 				border: 1px solid #ccc;
// 				border-radius: 4px;
// 				box-sizing: border-box;
// 				background-color: #f1f1f1;
// 			}

// 			select {
// 				width: 100%;
// 				padding: 12px 20px;
// 				margin: 8px 0;
// 				border: none;
// 				border-radius: 4px;
// 				background-color: #f1f1f1;
// 			}

// 			.container {
// 				display: block;
// 				position: relative;
// 				padding-left: 35px;
// 				margin: 8px 8px;
// 				cursor: pointer;
// 				-webkit-user-select: none;
// 				-moz-user-select: none;
// 				-ms-user-select: none;
// 				user-select: none;
// 			}
// 			/* Hide the browser's default checkbox */

// 			.container input {
// 				position: absolute;
// 				opacity: 0;
// 				cursor: pointer;
// 				height: 0;
// 				width: 0;
// 			}
// 			/* Create a custom checkbox */

// 			.checkmark {
// 				position: absolute;
// 				top: 0;
// 				left: 0;
// 				height: 20px;
// 				width: 20px;
// 				background-color: #eee;
// 			}
// 			/* On mouse-over, add a grey background color */

// 			.container:hover input ~ .checkmark {
// 				background-color: #ccc;
// 			}
// 			/* When the checkbox is checked, add a blue background */

// 			.container input:checked ~ .checkmark {
// 				background-color: #2196F3;
// 			}
// 			/* Create the checkmark/indicator (hidden when not checked) */

// 			.checkmark:after {
// 				content: "";
// 				position: absolute;
// 				display: none;
// 			}
// 			/* Show the checkmark when checked */

// 			.container input:checked ~ .checkmark:after {
// 				display: block;
// 			}
// 			/* Style the checkmark/indicator */

// 			.container .checkmark:after {
// 				left: 7px;
// 				top: 4px;
// 				width: 5px;
// 				height: 10px;
// 				border: solid white;
// 				border-width: 0 3px 3px 0;
// 				-webkit-transform: rotate(45deg);
// 				-ms-transform: rotate(45deg);
// 				transform: rotate(45deg);
// 			}
// 		</style>
// 	</head>

// 	<body>

// 		<h2>Create Project</h2>

// 		<div class="tab">
// 			<button class="tablinks" onclick="openTab(event, 'Project Setting')" id="defaultOpen">Project Setting</button>
// 			<button class="tablinks" onclick="openTab(event, 'Chip Setting')">Chip Setting</button>
// 			<button class="tablinks" onclick="openTab(event, 'Advance')">Advance</button>
// 			<button class="tablinks" onclick="openTab(event, 'Locations')">Locations</button>
// 			<button class="tablinks" onclick="openTab(event, 'Create')">Create</button>
// 		</div>

// 		<div id="Project Setting" class="tabcontent">
// 			<h3>Project Name</h3>
// 			<p>
// 				<input type="text" id="project_name" placeholder="Project name" name="project_name">
// 				<br>
// 			</p>
// 			<h3>Config</h3>
// 			<p>
// 				<input type="text" id="config_name" placeholder="Config name" name="config_name">
// 				<br>
// 			</p>
// 			<h3>Project Template</h3>
// 			<p>
// 				<select name="project_template" id="project_template">
// 					<option value="empty">Empty Project</option>
// 					<option value="blinky">Blinky Led Project</option>
// 				</select>
// 			</p>
// 		</div>

// 		<div id="Chip Setting" class="tabcontent">
// 			<h3>Code Execute Setting</h3>
// 			<p>
// 				<select name="xip" id="xip">
// 					<option value="non_xip">Non XIP (Execute in ITCM)</option>
// 					<option value="xip">XIP (Execute In Place)</option>
// 				</select>
// 			</p>
// 			<h3>Flash Size</h3>
// 			<p>
// 				<input type="number" name="flash_size" id="flash_size" placeholder="In byte">
// 			</p>
// 			<h3>Ram Size</h3>
// 			<p>
// 				<input type="number" name="ram_size" id="ram_size" placeholder="In byte">
// 			</p>
// 		</div>

// 		<div id="Advance" class="tabcontent">
// 			<h3>Optimization</h3>
// 			<p>Optimization Level
// 				<select name="op_level" id="op_level">
// 					<option value="-Og">Optimize for debug (-Og)</option>
// 					<option value="-O0">Otimization for compilation time (-O0)</option>
// 					<option value="-O1">Optimization for code size and execution time (-O1)</option>
// 					<option value="-O2">Optimization more for code size and execution time (-O2)</option>
// 					<option value="-O3">Optimization max for code size and execution time (-O3)</option>
// 					<option value="-Os">Optimization for code size (-Os)</option>
// 				</select>
// 			</p>
// 			<h3>Debug Level</h3>
// 			<p>
// 				<select name="debug_level" id="debug_level">
// 					<option value="-g3">Maximal debug information (-g3)</option>
// 					<option value="-g">Default debug information (-g)</option>
// 					<option value="-g1">Minimal debug information (-g1)</option>
// 					<option value="-g0">No debug information (-g0)</option>
// 				</select>
// 			</p>
// 		</div>

// 		<div id="Locations" class="tabcontent">
// 			<h3>RTLib Location</h3>
// 			<p>
// 				<input type="text" name="rtlib_loc" id="rtlib_loc" placeholder="/something/like/this/RTLib">
// 			</p>
// 			<h3>Make Location</h3>
// 			<p>
// 				<input type="text" name="make_loc" id="make_loc" placeholder="/something/like/this/make or make">
// 			</p>
// 			<h3>Workspace Location</h3>
// 			<p>
// 				<input type="text" name="workspace_loc" id="workspace_loc" placeholder="/something/like/this">
// 			</p>
// 			<h3>Toolchain Location</h3>
// 			<p>
// 				<input type="text" name="toolchain_loc" id="toolchain_loc" placeholder="/your/arm/toolchain/location/bin/">
// 			</p>
// 		</div>

// 		<script>
// 			const vscode = acquireVsCodeApi();

// 			window.addEventListener('message', event => {
// 				const message = event.data;
// 				switch (message.command) {
// 					case 'init':
// 						document.getElementById("flash_size").value = message.flash_size;
// 						document.getElementById("ram_size").value = message.ram_size;
// 						document.getElementById("rtlib_loc").value = message.rtlib_path;
// 						document.getElementById("make_loc").value = message.make_path;
// 						document.getElementById("workspace_loc").value = message.workspace_path;
// 						document.getElementById("toolchain_loc").value = message.toolchain_path;
// 						break;
// 				}
// 			});

// 			function openTab(evt, tabName) {
// 				if (tabName != "Create") {
// 					var i, tabcontent, tablinks;
// 					tabcontent = document.getElementsByClassName("tabcontent");
// 					for (i = 0; i < tabcontent.length; i++) {
// 						tabcontent[i].style.display = "none";
// 					}
// 					tablinks = document.getElementsByClassName("tablinks");
// 					for (i = 0; i < tablinks.length; i++) {
// 						tablinks[i].className = tablinks[i].className.replace(" active", "");
// 					}
// 					document.getElementById(tabName).style.display = "block";
// 					evt.currentTarget.className += " active";
// 				} else {
// 					vscode.postMessage({
// 						command: 'project_setting',
// 						project_name: document.getElementById("project_name").value,
// 						config_name: document.getElementById("config_name").value,
// 						xip: document.getElementById("xip").value,
// 						project_template: document.getElementById("project_template").value,
// 						flash_size: document.getElementById("flash_size").value,
// 						ram_size: document.getElementById("ram_size").value,
// 						op_level: document.getElementById("op_level").value,
// 						debug_level: document.getElementById("debug_level").value,
// 						rtlib_path: document.getElementById("rtlib_loc").value,
// 						make_path: document.getElementById("make_loc").value,
// 						workspace_path: document.getElementById("workspace_loc").value,
// 						toolchain_path: document.getElementById("toolchain_loc").value
// 					});
// 				}
// 			}

// 			// Get the element with id="defaultOpen" and click on it
// 			document.getElementById("defaultOpen").click();
// 		</script>

// 	</body>

// 	</html>`;
//             break;
//         case 'properties':
//             return `<!DOCTYPE html>
// 			<html>

// 			<head>
// 				<meta name="viewport" content="width=device-width, initial-scale=1">
// 				<style>
// 					* {
// 						box-sizing: border-box
// 					}

// 					body {
// 						font-family: "Lato", sans-serif;
// 						background: #252526;
// 						color: #FFFFFF;
// 					}
// 					/* Style the tab */

// 					.tab {
// 						float: left;
// 						border: 1px solid #ccc;
// 						background-color: var(background);
// 						width: 20%;
// 						height: 100%;
// 					}
// 					/* Style the buttons inside the tab */

// 					.tab button {
// 						display: block;
// 						background-color: inherit;
// 						color: #FFFFFF;
// 						padding: 22px 16px;
// 						width: 100%;
// 						border: none;
// 						outline: none;
// 						text-align: left;
// 						cursor: pointer;
// 						transition: 0.3s;
// 						font-size: 17px;
// 					}
// 					/* Change background color of buttons on hover */

// 					.tab button:hover {
// 						background-color: #ddd;
// 						color: black;
// 					}
// 					/* Create an active/current "tab button" class */

// 					.tab button.active {
// 						background-color: #ccc;
// 						color: black
// 					}
// 					/* Style the tab content */

// 					.tabcontent {
// 						float: left;
// 						padding: 12px 12px;
// 						border: 1px solid #ccc;
// 						width: 80%;
// 						height: 100%;
// 					}

// 					input {
// 						width: 100%;
// 						padding: 12px 20px;
// 						margin: 8px 0;
// 						display: inline-block;
// 						border: 1px solid #ccc;
// 						border-radius: 4px;
// 						box-sizing: border-box;
// 						background-color: #f1f1f1;
// 					}

// 					select {
// 						width: 100%;
// 						padding: 12px 20px;
// 						margin: 8px 0;
// 						border: none;
// 						border-radius: 4px;
// 						background-color: #f1f1f1;
// 					}

// 					.container {
// 						display: block;
// 						position: relative;
// 						padding-left: 35px;
// 						margin: 8px 8px;
// 						cursor: pointer;
// 						-webkit-user-select: none;
// 						-moz-user-select: none;
// 						-ms-user-select: none;
// 						user-select: none;
// 					}
// 					/* Hide the browser's default checkbox */

// 					.container input {
// 						position: absolute;
// 						opacity: 0;
// 						cursor: pointer;
// 						height: 0;
// 						width: 0;
// 					}
// 					/* Create a custom checkbox */

// 					.checkmark {
// 						position: absolute;
// 						top: 0;
// 						left: 0;
// 						height: 20px;
// 						width: 20px;
// 						background-color: #eee;
// 					}
// 					/* On mouse-over, add a grey background color */

// 					.container:hover input ~ .checkmark {
// 						background-color: #ccc;
// 					}
// 					/* When the checkbox is checked, add a blue background */

// 					.container input:checked ~ .checkmark {
// 						background-color: #2196F3;
// 					}
// 					/* Create the checkmark/indicator (hidden when not checked) */

// 					.checkmark:after {
// 						content: "";
// 						position: absolute;
// 						display: none;
// 					}
// 					/* Show the checkmark when checked */

// 					.container input:checked ~ .checkmark:after {
// 						display: block;
// 					}
// 					/* Style the checkmark/indicator */

// 					.container .checkmark:after {
// 						left: 7px;
// 						top: 4px;
// 						width: 5px;
// 						height: 10px;
// 						border: solid white;
// 						border-width: 0 3px 3px 0;
// 						-webkit-transform: rotate(45deg);
// 						-ms-transform: rotate(45deg);
// 						transform: rotate(45deg);
// 					}
// 				</style>
// 			</head>

// 			<body>

// 				<h2>Properties</h2>

// 				<div class="tab">
// 					<button class="tablinks" onclick="openTab(event, 'Project Setting')" id="defaultOpen">Project Setting</button>
// 					<button class="tablinks" onclick="openTab(event, 'Chip Setting')">Chip Setting</button>
// 					<button class="tablinks" onclick="openTab(event, 'Advance')">Advance</button>
// 					<button class="tablinks" onclick="openTab(event, 'Save')">Save</button>
// 					<button class="tablinks" onclick="openTab(event, 'Cancel')">Cancel</button>
// 				</div>

// 				<div id="Project Setting" class="tabcontent">
// 					<h3>Config</h3>
// 					<p>
// 						<input type="text" id="config_name" placeholder="Config name" name="config_name">
// 						<br>
// 					</p>
// 				</div>

// 				<div id="Chip Setting" class="tabcontent">
// 					<h3>Code Execute Setting</h3>
// 					<p>
// 						<select name="xip" id="xip">
// 							<option value="non_xip">Non XIP (Execute in ITCM)</option>
// 							<option value="xip">XIP (Execute In Place)</option>
// 						</select>
// 					</p>
// 					<h3>Flash Size</h3>
// 					<p>
// 						<input type="number" name="flash_size" id="flash_size" placeholder="In byte">
// 					</p>
// 					<h3>Ram Size</h3>
// 					<p>
// 						<input type="number" name="ram_size" id="ram_size" placeholder="In byte">
// 					</p>
// 				</div>

// 				<div id="Advance" class="tabcontent">
// 					<h3>Optimization</h3>
// 					<p>Optimization Level
// 						<select name="op_level" id="op_level">
// 							<option value="-Og">Optimize for debug (-Og)</option>
// 							<option value="-O0">Otimization for compilation time (-O0)</option>
// 							<option value="-O1">Optimization for code size and execution time (-O1)</option>
// 							<option value="-O2">Optimization more for code size and execution time (-O2)</option>
// 							<option value="-O3">Optimization max for code size and execution time (-O3)</option>
// 							<option value="-Os">Optimization for code size (-Os)</option>
// 						</select>
// 					</p>
// 					<h3>Debug Level</h3>
// 					<p>
// 						<select name="debug_level" id="debug_level">
// 							<option value="-g3">Maximal debug information (-g3)</option>
// 							<option value="-g">Default debug information (-g)</option>
// 							<option value="-g1">Minimal debug information (-g1)</option>
// 							<option value="-g0">No debug information (-g0)</option>
// 						</select>
// 					</p>
// 				</div>

// 				<script>
// 					const vscode = acquireVsCodeApi();

// 					window.addEventListener('message', event => {
// 						const message = event.data;
// 						switch (message.command) {
// 							case 'init':
// 								document.getElementById("config_name").value = message.config_name;
// 								document.getElementById("xip").value = message.xip;
// 								document.getElementById("flash_size").value = message.flash_size;
// 								document.getElementById("ram_size").value = message.ram_size;
// 								document.getElementById("op_level").value = message.op_level;
// 								document.getElementById("debug_level").value = message.debug_level;
// 								break;
// 						}
// 					});

// 					function openTab(evt, tabName) {
// 						if (tabName == "Save") {
// 							vscode.postMessage({
// 									command: 'save',
// 									config_name: document.getElementById("config_name").value,
// 									xip: document.getElementById("xip").value,
// 									flash_size: document.getElementById("flash_size").value,
// 									ram_size: document.getElementById("ram_size").value,
// 									op_level: document.getElementById("op_level").value,
// 									debug_level: document.getElementById("debug_level").value});
// 								} else if (tabName == "Cancel") {
// 									vscode.postMessage({
// 										command: 'cancel'
// 									});
// 								} else {
// 									var i, tabcontent, tablinks;
// 									tabcontent = document.getElementsByClassName("tabcontent");
// 									for (i = 0; i < tabcontent.length; i++) {
// 										tabcontent[i].style.display = "none";
// 									}
// 									tablinks = document.getElementsByClassName("tablinks");
// 									for (i = 0; i < tablinks.length; i++) {
// 										tablinks[i].className = tablinks[i].className.replace(" active", "");
// 									}
// 									document.getElementById(tabName).style.display = "block";
// 									evt.currentTarget.className += " active";
// 								}
// 							}

// 							// Get the element with id="defaultOpen" and click on it
// 							document.getElementById("defaultOpen").click();
// 				</script>

// 			</body>

// 			</html>`;
//             break;
//         default:
//             return '';
//             break;
//     }
// }



// class CatCodingPanel {
// 	/**
// 	 * Track the currently panel. Only allow a single panel to exist at a time.
// 	 */
//     public static currentPanel: CatCodingPanel | undefined;

//     public static readonly viewType = 'catCoding';

//     private readonly _panel: vscode.WebviewPanel;
//     private readonly _extensionPath: string;
//     private _disposables: vscode.Disposable[] = [];

//     public static createOrShow(extensionPath: string) {
//         const column = vscode.window.activeTextEditor
//             ? vscode.window.activeTextEditor.viewColumn
//             : undefined;

//         // If we already have a panel, show it.
//         if (CatCodingPanel.currentPanel) {
//             CatCodingPanel.currentPanel._panel.reveal(column);
//             return;
//         }

//         // Otherwise, create a new panel.
//         const panel = vscode.window.createWebviewPanel(
//             CatCodingPanel.viewType,
//             'Cat Coding',
//             column || vscode.ViewColumn.One,
//             {
//                 // Enable javascript in the webview
//                 enableScripts: true,

//                 // And restrict the webview to only loading content from our extension's `media` directory.
//                 localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'media'))]
//             }
//         );

//         CatCodingPanel.currentPanel = new CatCodingPanel(panel, extensionPath);
//     }

//     public static revive(panel: vscode.WebviewPanel, extensionPath: string) {
//         CatCodingPanel.currentPanel = new CatCodingPanel(panel, extensionPath);
//     }

//     private constructor(panel: vscode.WebviewPanel, extensionPath: string) {
//         this._panel = panel;
//         this._extensionPath = extensionPath;

//         // Set the webview's initial html content
//         this._update();

//         // Listen for when the panel is disposed
//         // This happens when the user closes the panel or when the panel is closed programatically
//         this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

//         // Update the content based on view changes
//         this._panel.onDidChangeViewState(
//             e => {
//                 if (this._panel.visible) {
//                     this._update();
//                 }
//             },
//             null,
//             this._disposables
//         );

//         // Handle messages from the webview
//         this._panel.webview.onDidReceiveMessage(
//             message => {
//                 switch (message.command) {
//                     case 'alert':
//                         vscode.window.showErrorMessage(message.text);
//                         return;
//                 }
//             },
//             null,
//             this._disposables
//         );
//     }

//     public doRefactor() {
//         // Send a message to the webview webview.
//         // You can send any JSON serializable data.
//         this._panel.webview.postMessage({ command: 'refactor' });
//     }

//     public dispose() {
//         CatCodingPanel.currentPanel = undefined;

//         // Clean up our resources
//         this._panel.dispose();

//         while (this._disposables.length) {
//             const x = this._disposables.pop();
//             if (x) {
//                 x.dispose();
//             }
//         }
//     }

//     private _update() {
//         const webview = this._panel.webview;

//         // Vary the webview's content based on where it is located in the editor.
//         switch (this._panel.viewColumn) {
//             case vscode.ViewColumn.Two:
//                 this._updateForCat(webview, 'Compiling Cat');
//                 return;

//             case vscode.ViewColumn.Three:
//                 this._updateForCat(webview, 'Testing Cat');
//                 return;

//             case vscode.ViewColumn.One:
//             default:
//                 this._updateForCat(webview, 'Coding Cat');
//                 return;
//         }
//     }

//     private _updateForCat(webview: vscode.Webview, catName: keyof typeof cats) {
//         this._panel.title = catName;
//         this._panel.webview.html = this._getHtmlForWebview(webview, cats[catName]);
//     }

//     private _getHtmlForWebview(webview: vscode.Webview, catGifPath: string) {
//         // Local path to main script run in the webview
//         const scriptPathOnDisk = vscode.Uri.file(
//             path.join(this._extensionPath, 'media', 'main.js')
//         );

//         // And the uri we use to load this script in the webview
//         const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

//         // Use a nonce to whitelist which scripts can be run
//         const nonce = getNonce();

//         return `<!DOCTYPE html>
//             <html lang="en">
//             <head>
//                 <meta charset="UTF-8">

//                 <!--
//                 Use a content security policy to only allow loading images from https or from our extension directory,
//                 and only allow scripts that have a specific nonce.
//                 -->
//                 <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

//                 <meta name="viewport" content="width=device-width, initial-scale=1.0">
//                 <title>Cat Coding</title>
//             </head>
//             <body>
//                 <img src="${catGifPath}" width="300" />
//                 <h1 id="lines-of-code-counter">0</h1>

//                 <script nonce="${nonce}" src="${scriptUri}"></script>
//             </body>
//             </html>`;
//     }
// }