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
                                        message.rtlib_path,
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
                                        path.join(message.rtlib_path, 'inc').split('\\').join('\\\\'),
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
                                let main_uri = vscode.Uri.file(project_path + '/src/main.cpp');
                                vscode.commands.executeCommand('vscode.open', main_uri);
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
                project_path: vscode.workspace.workspaceFile?.fsPath ? path.dirname(vscode.workspace.workspaceFile?.fsPath).split('\\').join('\\\\') : '',
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
        let project_path = project_location.fsPath.split('\\').join('\\\\');
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