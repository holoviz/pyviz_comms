import {
  DocumentRegistry
} from '@jupyterlab/docregistry'

import {
  INotebookModel,
  NotebookPanel
} from '@jupyterlab/notebook'

import {
  JupyterFrontEndPlugin,
  JupyterLab
} from '@jupyterlab/application'

import {
  IDisposable,
  DisposableDelegate
} from '@phosphor/disposable'

import {
  ContextManager
} from './manager'

import {
  HVJSExec,
  HVJSLoad,
  HV_EXEC_MIME_TYPE,
  HV_LOAD_MIME_TYPE
} from './renderer'


export
  type INBWidgetExtension = DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel>;


export
  class NBWidgetExtension implements INBWidgetExtension {
  createNew(nb: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): IDisposable {
    let manager = new ContextManager(context);

    nb.rendermime.addFactory({
      safe: false,
      mimeTypes: [HV_LOAD_MIME_TYPE],
      createRenderer: (options) => new HVJSLoad(options)
    }, -1);

    nb.rendermime.addFactory({
      safe: false,
      mimeTypes: [HV_EXEC_MIME_TYPE],
      createRenderer: (options) => new HVJSExec(options, manager)
    }, -1);

    return new DisposableDelegate(() => {
      if (nb.rendermime) {
        nb.rendermime.removeMimeType(HV_EXEC_MIME_TYPE);
      }
      manager.dispose();
    });
  }
}

export
  const extension: JupyterFrontEndPlugin<void> = {
    id: 'jupyterlab_holoviews',
    autoStart: true,
    activate: (app: JupyterLab) => {
      // this adds the HoloViews widget extension onto Notebooks specifically
      app.docRegistry.addWidgetExtension('Notebook', new NBWidgetExtension());
    }
  }
