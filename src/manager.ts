import { IDisposable } from '@lumino/disposable';

import { DocumentRegistry } from '@jupyterlab/docregistry';

import { Kernel } from '@jupyterlab/services';

/**
 * A micro manager that contains the document context
 */
export class ContextManager implements IDisposable {
  _wManager: any;
  private _context: DocumentRegistry.IContext<DocumentRegistry.IModel> | null;
  private _comm: Kernel.IComm | undefined;

  constructor(
    context: DocumentRegistry.IContext<DocumentRegistry.IModel>,
    manager: any
  ) {
    this._context = context;
    this._wManager = manager;

    this._comm = undefined;
    context.sessionContext.statusChanged.connect(
      (session: any, status: any) => {
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
