import {
  IDisposable
} from '@phosphor/disposable';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';


/**
 * A micro manager that contains the document context
 */
export
class ContextManager implements IDisposable {
  private _context: DocumentRegistry.IContext<DocumentRegistry.IModel>;

  constructor(context: DocumentRegistry.IContext<DocumentRegistry.IModel>) {
    this._context = context;
  }

  get context() {
    return this._context;
  }

  get isDisposed(): boolean {
    return this._context === null;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
	for (let key in (window as any).HoloViews.kernels) {
      const kernel = (window as any).HoloViews.kernels[key];
      if (kernel == this.context.session.kernel) {
        delete (window as any).HoloViews.kernels[key];
      }
	  if (key in (window as any).HoloViews.index) {
		delete (window as any).HoloViews.index[key];
      }
    }
    this._context = null;
  }
}
