import {
  INotebookTracker,
  NotebookPanel,
  INotebookModel
} from '@jupyterlab/notebook';

import {
  JupyterFrontEndPlugin,
  JupyterFrontEnd,
  ILayoutRestorer
} from '@jupyterlab/application';

import {
  ICommandPalette,
  WidgetTracker,
  ToolbarButton
} from '@jupyterlab/apputils';

import { PageConfig } from '@jupyterlab/coreutils';

import { IDocumentManager } from '@jupyterlab/docmanager';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { IMainMenu } from '@jupyterlab/mainmenu';

import { IRenderMime } from '@jupyterlab/rendermime-interfaces';

import { CommandRegistry } from '@lumino/commands';

import { ReadonlyPartialJSONObject } from '@lumino/coreutils';

import { IDisposable, DisposableDelegate } from '@lumino/disposable';

import { panelIcon } from './icons';

import { ContextManager } from './manager';

import {
  PanelPreview,
  IPanelPreviewTracker,
  PanelPreviewFactory
} from './preview';

import {
  HVJSExec,
  HVJSLoad,
  HV_EXEC_MIME_TYPE,
  HV_LOAD_MIME_TYPE
} from './renderer';

export type INBWidgetExtension = DocumentRegistry.IWidgetExtension<
  NotebookPanel,
  INotebookModel
>;

import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css'; // optional for styling

let registerWidgetManager: any = null;
try {
  const jlm = require('@jupyter-widgets/jupyterlab-manager');
  registerWidgetManager = jlm.registerWidgetManager;
} catch (_) {
  console.log('Could not load ipywidgets support for @pyviz/jupyterlab_pyviz');
}

/**
 * The command IDs used by the plugin.
 */
export namespace CommandIDs {
  export const panelRender = 'notebook:render-with-panel';

  export const panelOpen = 'notebook:open-with-panel';

  export const lumenRender = 'notebook:render-with-lumen';

  export const lumenOpen = 'notebook:open-with-lumen';
}

const TOOLTIP_CONTENT = `
<span>Preview with Panel<span>
<br>
<br>
<span>
  <b>Note:</b> Your notebook must publish Panel contents with .servable().
<span>
`;

/**
 * A notebook widget extension that adds a panel preview button to the toolbar.
 */
class PanelRenderButton
  implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel>
{
  /**
   * Instantiate a new PanelRenderButton.
   * @param commands The command registry.
   */
  constructor(commands: CommandRegistry) {
    this._commands = commands;
  }

  /**
   * Create a new extension object.
   */
  createNew(panel: NotebookPanel): IDisposable {
    const button = new ToolbarButton({
      className: 'panelRender',
      icon: panelIcon,
      onClick: (): void => {
        this._commands.execute(CommandIDs.panelRender);
      }
    });

    setTimeout(() => {
      requestAnimationFrame(() => {
        tippy(button.node, {
          allowHTML: true,
          arrow: true,
          content: TOOLTIP_CONTENT,
          placement: 'bottom'
        });
      });
    }, 0);

    panel.toolbar.insertAfter('cellType', 'panelRender', button);
    return button;
  }

  private _commands: CommandRegistry;
}

/**
 * A notebook widget extension that adds a panel preview button to the toolbar.
 */
class LumenRenderButton
  implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel>
{
  /**
   * Instantiate a new PanelRenderButton.
   * @param commands The command registry.
   */
  constructor(commands: CommandRegistry) {
    this._commands = commands;
  }

  /**
   * Create a new extension object.
   */
  createNew(panel: NotebookPanel): IDisposable {
    const button = new ToolbarButton({
      className: 'lumenRender',
      icon: panelIcon,
      onClick: () => {
        this._commands.execute(CommandIDs.lumenRender);
      }
    });

    setTimeout(() => {
      requestAnimationFrame(() => {
        tippy(button.node, {
          arrow: true,
          content: 'Preview with Lumen',
          placement: 'bottom'
        });
      });
    }, 0);

    panel.toolbar.addItem('lumenRender', button);
    return button;
  }

  private _commands: CommandRegistry;
}

export class NBWidgetExtension implements INBWidgetExtension {
  _docmanager!: IDocumentManager;
  _app: JupyterFrontEnd;

  constructor(app: JupyterFrontEnd) {
    this._app = app;
  }

  createNew(
    nb: NotebookPanel,
    context: DocumentRegistry.IContext<INotebookModel>
  ): IDisposable {
    const doc_context = (this._docmanager as any)._findContext(
      context.path,
      'notebook'
    );

    // Hack to get access to the widget manager
    const renderer: any = { manager: null };
    if (registerWidgetManager !== null) {
      registerWidgetManager(doc_context as any, nb.content.rendermime, [
        renderer
      ] as any);
    }

    const manager = new ContextManager(this._app, context, renderer.manager);

    nb.content.rendermime.addFactory(
      {
        safe: false,
        mimeTypes: [HV_LOAD_MIME_TYPE],
        createRenderer: (
          options: IRenderMime.IRendererOptions
        ): IRenderMime.IRenderer => {
          return new HVJSLoad(options, manager);
        }
      },
      -1
    );

    nb.content.rendermime.addFactory(
      {
        safe: false,
        mimeTypes: [HV_EXEC_MIME_TYPE],
        createRenderer: (
          options: IRenderMime.IRendererOptions
        ): IRenderMime.IRenderer => {
          return new HVJSExec(options, manager);
        }
      },
      -1
    );

    return new DisposableDelegate(() => {
      if (nb.content.rendermime) {
        nb.content.rendermime.removeMimeType(HV_EXEC_MIME_TYPE);
      }
      manager.dispose();
    });
  }
}

export const extension: JupyterFrontEndPlugin<IPanelPreviewTracker> = {
  id: '@pyviz/jupyterlab_pyviz:plugin',
  autoStart: true,
  requires: [IDocumentManager, INotebookTracker],
  optional: [ICommandPalette, ILayoutRestorer, IMainMenu, ISettingRegistry],
  provides: IPanelPreviewTracker,
  activate: (
    app: JupyterFrontEnd,
    docmanager: IDocumentManager,
    notebooks: INotebookTracker,
    palette: ICommandPalette | null,
    restorer: ILayoutRestorer | null,
    menu: IMainMenu | null,
    settingRegistry: ISettingRegistry | null
  ) => {
    const nb_extension = new NBWidgetExtension(app);
    nb_extension._docmanager = docmanager;
    app.docRegistry.addWidgetExtension('Notebook', nb_extension);

    // Create a widget tracker for Panel Previews.
    const tracker = new WidgetTracker<PanelPreview>({
      namespace: 'panel-preview'
    });

    if (restorer) {
      restorer.restore(tracker, {
        command: 'docmanager:open',
        args: panel => ({
          path: panel.context.path,
          factory: factory.name
        }),
        name: panel => panel.context.path,
        when: app.serviceManager.ready
      });
    }

    function getCurrent(args: ReadonlyPartialJSONObject): NotebookPanel | null {
      const widget = notebooks.currentWidget;
      const activate = args['activate'] !== false;

      if (activate && widget) {
        app.shell.activateById(widget.id);
      }

      return widget;
    }

    function getCurrentYaml(
      args: ReadonlyPartialJSONObject
    ): NotebookPanel | null {
      return app.shell.currentWidget as any;
    }

    function isEnabled(): boolean {
      const widget: any = app.shell.currentWidget;
      if (widget === null || widget.context === undefined) {
        return false;
      }
      return (
        widget.context.path.endsWith('.yaml') ||
        widget.context.path.endsWith('.yml') ||
        (notebooks.currentWidget !== null && notebooks.currentWidget === widget)
      );
    }

    function getPanelUrl(path: string): string {
      const baseUrl = PageConfig.getBaseUrl();
      return `${baseUrl}panel-preview/render/${path}`;
    }

    const factory = new PanelPreviewFactory(getPanelUrl, {
      name: 'Panel-preview',
      fileTypes: ['notebook'],
      modelName: 'notebook'
    });

    const lumenFactory = new PanelPreviewFactory(getPanelUrl, {
      name: 'Lumen-preview',
      fileTypes: ['yaml', 'yml', 'text', 'py'],
      modelName: 'text'
    });

    factory.widgetCreated.connect((sender, widget) => {
      // Notify the widget tracker if restore data needs to update.
      widget.context.pathChanged.connect(() => {
        void tracker.save(widget);
      });
      // Add the notebook panel to the tracker.
      void tracker.add(widget);
    });

    lumenFactory.widgetCreated.connect((sender, widget) => {
      // Add the notebook panel to the tracker.
      void tracker.add(widget);
    });

    const updateSettings = (settings: ISettingRegistry.ISettings): void => {
      factory.defaultRenderOnSave = settings.get('renderOnSave')
        .composite as boolean;
    };

    if (settingRegistry) {
      Promise.all([settingRegistry.load(extension.id), app.restored])
        .then(([settings]) => {
          updateSettings(settings);
          settings.changed.connect(updateSettings);
        })
        .catch((reason: Error) => {
          console.error(reason.message);
        });
    }

    app.docRegistry.addWidgetFactory(factory);
    app.docRegistry.addWidgetFactory(lumenFactory);

    const { commands, docRegistry } = app;

    commands.addCommand(CommandIDs.panelRender, {
      label: 'Preview Notebook with Panel',
      execute: async args => {
        const current = getCurrent(args);
        let context: DocumentRegistry.IContext<INotebookModel>;
        if (current) {
          context = current.context;
          await context.save();

          commands.execute('docmanager:open', {
            path: context.path,
            factory: 'Panel-preview',
            options: {
              mode: 'split-right'
            }
          });
        }
      },
      isEnabled
    });

    commands.addCommand(CommandIDs.lumenRender, {
      label: 'Render Yaml with Lumen',
      execute: async args => {
        const current = getCurrentYaml(args);
        let context: DocumentRegistry.IContext<INotebookModel>;
        if (current) {
          context = current.context;
          await context.save();

          commands.execute('docmanager:open', {
            path: context.path,
            factory: 'Lumen-preview',
            options: {
              mode: 'split-right'
            }
          });
        }
      },
      isEnabled
    });

    commands.addCommand(CommandIDs.panelOpen, {
      label: 'Open with Panel in New Browser Tab',
      execute: async args => {
        const current = getCurrent(args);
        if (!current) {
          return;
        }
        await current.context.save();
        const panelUrl = getPanelUrl(current.context.path);
        window.open(panelUrl);
      },
      isEnabled
    });

    if (palette) {
      const category = 'Notebook Operations';
      [CommandIDs.panelRender, CommandIDs.panelOpen].forEach(command => {
        palette.addItem({ command, category });
      });
    }

    if (menu) {
      menu.viewMenu.addGroup(
        [
          {
            command: CommandIDs.panelRender
          },
          {
            command: CommandIDs.panelOpen
          }
        ],
        1000
      );
    }

    const panelButton = new PanelRenderButton(commands);

    docRegistry.addWidgetExtension('Notebook', panelButton);

    const lumenButton = new LumenRenderButton(commands);

    docRegistry.addWidgetExtension('Editor', lumenButton);

    return tracker;
  }
};
