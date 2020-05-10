import {
  DocumentRegistry
} from '@jupyterlab/docregistry'

import {
  INotebookModel,
  NotebookPanel,
} from '@jupyterlab/notebook'

import {
  JupyterFrontEndPlugin,
  JupyterFrontEnd
} from '@jupyterlab/application'

import {
  IDisposable,
  DisposableDelegate
} from '@lumino/disposable'

import { IDocumentManager } from "@jupyterlab/docmanager";

import { Context } from "@jupyterlab/docregistry";

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


let registerWidgetManager: any = null;
try {
  const jlm = require('@jupyter-widgets/jupyterlab-manager');
  registerWidgetManager = jlm.registerWidgetManager;
} catch(e) {
  console.log(e);
}

export
class NBWidgetExtension implements INBWidgetExtension {
  _docmanager: IDocumentManager

  createNew(nb: NotebookPanel, context: DocumentRegistry.IContext<INotebookModel>): IDisposable {
    const doc_context = (this._docmanager as any)._findContext(context.path, "notebook")

    // Hack to get access to the widget manager
    const renderer: any = {manager: null}
    if (registerWidgetManager != null)
      registerWidgetManager((doc_context as any), nb.content.rendermime, ([renderer] as any));

    let manager = new ContextManager(context, renderer.manager);

    nb.content.rendermime.addFactory({
      safe: false,
      mimeTypes: [HV_LOAD_MIME_TYPE],
      createRenderer: (options: any) => new HVJSLoad(options, manager)
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
    requires: [
      IDocumentManager
    ],
    activate: (app: JupyterFrontEnd, docmanager: IDocumentManager) => {
      const extension = new NBWidgetExtension()
      extension._docmanager = docmanager
      app.docRegistry.addWidgetExtension('Notebook', extension);
    }
  }
