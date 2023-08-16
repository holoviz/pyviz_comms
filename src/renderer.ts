import { IRenderMime } from '@jupyterlab/rendermime-interfaces';

import { Kernel, KernelMessage } from '@jupyterlab/services';

import { ReadonlyJSONObject } from '@lumino/coreutils';

import { JSONObject, JSONValue } from '@lumino/coreutils';

import { Widget } from '@lumino/widgets';

import { ContextManager } from './manager';

export declare interface ICommProxy {
  open(
    data?: JSONValue,
    metadata?: JSONObject,
    buffers?: (ArrayBuffer | ArrayBufferView)[]
  ): void;
  send(
    data: JSONValue,
    metadata?: JSONObject,
    buffers?: (ArrayBuffer | ArrayBufferView)[],
    disposeOnDone?: boolean
  ): void;
  onMsg: (msg: KernelMessage.ICommMsgMsg) => void;
}

export declare interface IKernelProxy {
  // copied from https://github.com/jupyterlab/jupyterlab/blob/master/packages/services/src/kernel/default.ts#L605
  registerCommTarget(
    targetName: string,
    callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void
  ): void;
  connectToComm(targetName: string, commId?: string): ICommProxy;
}

export declare interface IWidgetManagerProxy {
  create_view(model: any): any;
  display_view(view: any, el: any): any;
  set_state(state: any): Promise<any[]>;
}

/**
 * The MIME types for PyViz
 */
const HTML_MIME_TYPE = 'text/html';
const JS_MIME_TYPE = 'application/javascript';
export const HV_LOAD_MIME_TYPE = 'application/vnd.holoviews_load.v0+json';
export const HV_EXEC_MIME_TYPE = 'application/vnd.holoviews_exec.v0+json';

/**
 * Load HVJS and CSS into the DOM
 */
export class HVJSLoad extends Widget implements IRenderMime.IRenderer {
  private _load_mimetype: string = HV_LOAD_MIME_TYPE;
  private _script_element: HTMLScriptElement;
  private _manager: ContextManager;

  constructor(options: IRenderMime.IRendererOptions, manager: ContextManager) {
    super();
    this._script_element = document.createElement('script');
    this._manager = manager;
  }

  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    const data = model.data[this._load_mimetype] as string;
    this._script_element.textContent = data;
    this.node.appendChild(this._script_element);
    this._manager.comm; // Ensure comm is initialized
    return Promise.resolve();
  }
}

/**
 * Exec HVJS in window
 */
export class HVJSExec extends Widget implements IRenderMime.IRenderer {
  // for classic nb compat reasons, the payload in contained in these mime messages
  private _html_mimetype: string = HTML_MIME_TYPE;
  private _js_mimetype: string = JS_MIME_TYPE;
  // the metadata is stored here
  private _dispose: boolean;
  private _document_id: string | null;
  private _server_id: string | null;
  private _exec_mimetype: string = HV_EXEC_MIME_TYPE;
  private _script_element!: HTMLScriptElement;
  private _div_element!: HTMLDivElement;
  private _manager: ContextManager;
  private _displayed: boolean;

  constructor(options: IRenderMime.IRendererOptions, manager: ContextManager) {
    super();
    this._createNodes();
    this._manager = manager;
    this._displayed = false;
    this._dispose = true;
    this._document_id = null;
    this._server_id = null;
  }

  _createNodes(): void {
    this._div_element = document.createElement('div');
    this._script_element = document.createElement('script');
    this._script_element.setAttribute('type', 'text/javascript');
  }

  _registerKernel(id: string): void {
    const set_state = (state: any): Promise<any[]> => {
      return this._manager._wManager.set_state(state);
    };
    const create_view = (model: any, options?: any): any => {
      return this._manager._wManager.create_view(model, options);
    };
    const display_view = (view: any, el: any): any => {
      return this._manager._wManager.display_view(view, el);
    };
    const widget_manager: IWidgetManagerProxy = {
      create_view,
      set_state,
      display_view
    };
    (window as any).PyViz.widget_manager = widget_manager;

    const manager = this._manager;
    const kernel = manager!.context.sessionContext.session?.kernel;
    const registerClosure = (
      targetName: string,
      callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void
    ): void => {
      if (kernel === undefined) {
        console.log(
          'Kernel not found, could not register comm target ',
          targetName
        );
        return;
      }
      return kernel.registerCommTarget(targetName, callback);
    };
    const connectClosure = (targetName: string, commId?: string): any => {
      if (kernel === undefined) {
        console.log(
          'Kernel not found, could not connect to comm target ',
          targetName
        );
        return {
          open: function (): void {},
          send: function (): void {},
          onMsg: function (): void {}
        };
      }
      const comm: Kernel.IComm = kernel.createComm(targetName, commId);
      const sendClosure = (
        data: JSONValue,
        metadata?: JSONObject,
        buffers?: (ArrayBuffer | ArrayBufferView)[],
        disposeOnDone?: boolean
      ): void => {
        if (!comm.isDisposed) {
          comm.send(data, metadata, buffers, disposeOnDone);
        }
      };
      const openClosure = (
        data?: JSONValue,
        metadata?: JSONObject,
        buffers?: (ArrayBuffer | ArrayBufferView)[]
      ): void => {
        comm.open(data, metadata, buffers);
      };
      const comm_proxy: ICommProxy = {
        set onMsg(callback: (msg: KernelMessage.ICommMsgMsg) => void) {
          comm.onMsg = callback;
        },
        open: openClosure,
        send: sendClosure
      };
      return comm_proxy;
    };
    const kernel_proxy: IKernelProxy = {
      connectToComm: connectClosure,
      registerCommTarget: registerClosure
    };
    (window as any).PyViz.kernels[id] = kernel_proxy;

    this._manager.context.sessionContext.statusChanged.connect(
      (session: any, status: string) => {
        if (status === 'restarting' || status === 'dead') {
          delete (window as any).PyViz.kernels[id];
          this._dispose = false;
        }
      },
      this
    );
  }

  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    const metadata = model.metadata[this._exec_mimetype] as ReadonlyJSONObject;
    const id = metadata.id as string;
    if (this._displayed) {
      this._disposePlot();
      this.node.removeChild(this._div_element);
      this.node.removeChild(this._script_element);
      this._createNodes();
    }
    this._dispose = true;
    if (id !== undefined) {
      if ((window as any).PyViz === undefined) {
        (window as any).PyViz = {
          comms: {},
          comm_status: {},
          kernels: {},
          receivers: {},
          plot_index: []
        };
      } else if ((window as any).PyViz.plot_index === undefined) {
        (window as any).PyViz.plot_index = {};
      }

      const html_data = model.data[this._html_mimetype] as string;
      this._div_element.innerHTML = html_data;
      const scripts = [];
      const nodelist = this._div_element.querySelectorAll('script');
      for (const i in nodelist) {
        if (nodelist.hasOwnProperty(i)) {
          scripts.push(nodelist[i]);
        }
      }

      scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        const attrs = [];
        const nodemap = oldScript.attributes;
        for (const j in nodemap) {
          if (nodemap.hasOwnProperty(j)) {
            attrs.push(nodemap[j]);
          }
        }
        attrs.forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      });
      this.node.appendChild(this._div_element);

      if (this._js_mimetype in model.data) {
        const data = model.data[this._js_mimetype] as string;
        this._script_element.textContent = data;
        this.node.appendChild(this._script_element);
      }

      this._registerKernel(id);
      this._displayed = true;
      this._document_id = id;
    } else if (metadata.server_id !== undefined) {
      // I'm a server document
      this._server_id = metadata.server_id as string;
      const data = model.data[this._html_mimetype] as string;
      const d = document.createElement('div');
      d.innerHTML = data;
      const script = d.children[0];
      const attrs = [];
      const nodemap = script.attributes;
      for (const j in nodemap) {
        if (nodemap.hasOwnProperty(j)) {
          attrs.push(nodemap[j]);
        }
      }
      attrs.forEach(attr =>
        this._script_element.setAttribute(attr.name, attr.value)
      );
      this._script_element.appendChild(
        document.createTextNode(script.innerHTML)
      );
      this.node.appendChild(this._script_element);
    }
    return Promise.resolve().then(() => {
      if (
        (window as any).Bokeh !== undefined &&
        id in (window as any).Bokeh.index
      ) {
        (window as any).PyViz.plot_index[id] = (window as any).Bokeh.index[id];
      } else {
        (window as any).PyViz.plot_index[id] = null;
      }
    });
  }

  _disposePlot(): void {
    if (this._server_id) {
      if (this._manager.comm !== null && this._dispose) {
        this._manager.comm.send({
          event_type: 'server_delete',
          id: this._server_id
        });
      }
      this._server_id = null;
    } else if (this._document_id) {
      const id = this._document_id;
      if (this._manager.comm != null && this._dispose) {
        this._manager.comm.send({ event_type: 'delete', id: id });
      }
      if ((window as any).PyViz !== undefined) {
        if ((window as any).PyViz.kernels !== undefined) {
          delete (window as any).PyViz.kernels[id];
        }
        if ((window as any).PyViz.plot_index !== undefined) {
          delete (window as any).PyViz.plot_index[id];
        }
      }
      if (
        (window as any).Bokeh !== undefined &&
        id in (window as any).Bokeh.index
      ) {
        const doc: any = (window as any).Bokeh.index[id].model.document;
        doc.clear();
        const i = (window as any).Bokeh.documents.indexOf(doc);
        if (i > -1) {
          (window as any).Bokeh.documents.splice(i, 1);
        }
      }
      this._document_id = null;
    }
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._disposePlot();
    super.dispose();
  }
}
