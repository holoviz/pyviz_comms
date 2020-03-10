import {
  DocumentRegistry
} from '@jupyterlab/docregistry'

import {
  INotebookModel,
  NotebookPanel
} from '@jupyterlab/notebook'

import {
  JupyterFrontEndPlugin,
  JupyterFrontEnd
} from '@jupyterlab/application'

import {
  IDisposable,
  DisposableDelegate
} from '@lumino/disposable'

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

    nb.content.rendermime.addFactory({
      safe: false,
      mimeTypes: [HV_LOAD_MIME_TYPE],
      createRenderer: (options: any) => new HVJSLoad(options)
    }, -1);

    nb.content.rendermime.addFactory({
      safe: false,
      mimeTypes: [HV_EXEC_MIME_TYPE],
      createRenderer: (options: any) => new HVJSExec(options, manager)
    }, -1);

    return new DisposableDelegate(() => {
      if (nb.content.rendermime) {
        nb.content.rendermime.removeMimeType(HV_EXEC_MIME_TYPE);
      }
      manager.dispose();
    });
  }
}

export
  const extension: JupyterFrontEndPlugin<void> = {
    id: '@pyviz/jupyterlab_pyviz',
    autoStart: true,
    activate: (app: JupyterFrontEnd) => {
      // this adds the HoloViews widget extension onto Notebooks specifically
      app.docRegistry.addWidgetExtension('Notebook', new NBWidgetExtension());
    }
  }
