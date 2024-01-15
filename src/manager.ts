import { IDisposable } from '@lumino/disposable';
import { JSONExt } from '@lumino/coreutils';

import { URLExt, PageConfig } from '@jupyterlab/coreutils';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { Kernel, ServerConnection } from '@jupyterlab/services';

import { JupyterFrontEnd } from '@jupyterlab/application';

const fetch = ServerConnection.makeRequest;

const API_ROOT = URLExt.join(PageConfig.getBaseUrl(), '/panel-preview/');
const API_LAYOUT = URLExt.join(API_ROOT, '/layout/');

/**
 * A micro manager that contains the document context
 */
export class ContextManager implements IDisposable {
  _wManager: any;
  private _app: JupyterFrontEnd;
  private _context: DocumentRegistry.IContext<DocumentRegistry.IModel> | null;
  private _comm: Kernel.IComm | undefined;

  constructor(
    app: JupyterFrontEnd,
    context: DocumentRegistry.IContext<DocumentRegistry.IModel>,
    manager: any
  ) {
    this._app = app;
    this._context = context;
    this._wManager = manager;

    this._comm = undefined;
    context.saveState.connect(async (context: any, status: string) => {
      if (status !== 'started') {
        return;
      }
      const layout_path = URLExt.join(API_LAYOUT, context.path);
      const response = await fetch(
        layout_path,
        { method: 'GET' },
        this._app.serviceManager.serverSettings
      );
      if (response.status !== 200) {
        return;
      }
      const layout = await response.json();
      let changed = false;
      for (const cell of context.model.cells) {
        const cell_layout = layout.cells[cell.id];
        const cell_meta = cell.getMetadata();
        if (!JSONExt.deepEqual(cell_meta['panel-layout'], cell_layout)) {
          cell.setMetadata('panel-layout', cell_layout);
          changed = true;
        }
      }
      const nb_meta = context.model.getMetadata();
      if (!JSONExt.deepEqual(nb_meta['panel-cell-order'], layout.order)) {
        context.model.setMetadata('panel-cell-order', layout.order);
        changed = true;
      }
      if (changed) {
        context.save();
      }
    });
    context.sessionContext.statusChanged.connect(
      (session: any, status: string) => {
        if (status === 'restarting' || status === 'dead') {
          this._comm = undefined;
        }
      },
      this
    );
  }

  get context(): any {
    return this._context;
  }

  get comm(): any {
    if (this._context?.sessionContext === null) {
      return null;
    }
    if (
      this._comm === null &&
      this._context?.sessionContext.session?.kernel !== null
    ) {
      this._comm =
        this._context?.sessionContext.session?.kernel.createComm(
          'hv-extension-comm'
        );
      if (this._comm) {
        this._comm.open();
      }
    }
    return this._comm;
  }

  set comm(comm) {
    this._comm = comm;
  }

  get isDisposed(): boolean {
    return this._context === null;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._context = null;
    this._comm = undefined;
  }
}
