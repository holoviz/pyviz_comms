import {
  IDisposable
} from '@lumino/disposable';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  Kernel
} from '@jupyterlab/services'


/**
 * A micro manager that contains the document context
 */
export
class ContextManager implements IDisposable {
  private _context: DocumentRegistry.IContext<DocumentRegistry.IModel>;
  private _comm: Kernel.IComm | null;

  constructor(context: DocumentRegistry.IContext<DocumentRegistry.IModel>) {
    this._context = context;
    this._comm = null;
  }

  get context() {
    return this._context;
  }

  get comm() {
    if ((this._comm === null) && (this._context.sessionContext.session?.kernel !== null)) {
      this._comm = this._context.sessionContext.session?.kernel.createComm("hv-extension-comm");
      this._comm.open();
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
    this._comm = null;
  }
}
