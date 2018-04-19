import {
  IRenderMime
} from '@jupyterlab/rendermime-interfaces'

import {
  Kernel,
  KernelMessage
} from '@jupyterlab/services'

import {
    IClientSession
} from '@jupyterlab/apputils';

import {
  ReadonlyJSONObject
} from '@phosphor/coreutils'

import {
  IDisposable
} from '@phosphor/disposable';

import {
  JSONObject, JSONValue
} from '@phosphor/coreutils';

import {
  Widget
} from '@phosphor/widgets'

import {
  ContextManager
} from './manager';

import {
  init_slider, init_dropdown
} from './widgets';

import * as jquery from 'jquery';

export declare interface CommProxy {
  open(data?: JSONValue, metadata?: JSONObject, buffers?: (ArrayBuffer | ArrayBufferView)[]): Promise<void>,
  send(data: JSONValue, metadata?: JSONObject, buffers?: (ArrayBuffer | ArrayBufferView)[], disposeOnDone?: boolean): Promise<void>,
  onMsg: (msg: KernelMessage.ICommOpenMsg) => void
}

export declare interface KernelProxy {
  // copied from https://github.com/jupyterlab/jupyterlab/blob/master/packages/services/src/kernel/default.ts#L605
  registerCommTarget(targetName: string, callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void): IDisposable,
  connectToComm(targetName: string, commId?: string): CommProxy,
}

/**
 * The MIME types for HoloViews
 */
const HTML_MIME_TYPE = 'text/html'
const JS_MIME_TYPE = 'application/javascript'
export const HV_LOAD_MIME_TYPE = 'application/vnd.holoviews_load.v0+json'
export const HV_EXEC_MIME_TYPE = 'application/vnd.holoviews_exec.v0+json'

/**
 * Load HVJS and CSS into the DOM
 */
export
class HVJSLoad extends Widget implements IRenderMime.IRenderer {
  private _load_mimetype: string = HV_LOAD_MIME_TYPE
  private _script_element: HTMLScriptElement

  constructor(options: IRenderMime.IRendererOptions) {
    super();
    this._script_element = document.createElement("script");
    (window as any).jQuery = jquery;
    (window as any).$ = jquery;
  }

  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    let data = model.data[this._load_mimetype] as string
    this._script_element.textContent = data;
    this.node.appendChild(this._script_element)
    return Promise.resolve()
  }
}

/**
 * Exec HVJS in window
 */
export
class HVJSExec extends Widget implements IRenderMime.IRenderer {
  // for classic nb compat reasons, the payload in contained in these mime messages
  private _html_mimetype: string = HTML_MIME_TYPE
  private _js_mimetype: string = JS_MIME_TYPE
  // the metadata is stored here
  private _document_id: string
  private _exec_mimetype: string = HV_EXEC_MIME_TYPE
  private _script_element: HTMLScriptElement
  private _div_element: HTMLDivElement
  private _manager: ContextManager;

  constructor(options: IRenderMime.IRendererOptions, manager: ContextManager) {
    super()
    this._div_element = document.createElement("div")
    this._script_element = document.createElement("script")
    this._manager = manager
  }

  get isDisposed(): boolean {
    return this._manager === null;
  }

  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    let metadata = model.metadata[this._exec_mimetype] as ReadonlyJSONObject
    const id = metadata.id as string;
    if (id !== undefined) {
      // I'm a static document
      if ((window as any).HoloViews === undefined) {
        (window as any).HoloViews = {kernels: {}};
      }
      (window as any).HoloViews.init_slider = init_slider;
      (window as any).HoloViews.init_dropdown = init_dropdown;

      const html_data = model.data[this._html_mimetype] as string;
      this._div_element.innerHTML = html_data;
      this.node.appendChild(this._div_element)

      let data = model.data[this._js_mimetype] as string;
      this._script_element.textContent = data;
      const manager = this._manager;
      const kernel = manager.context.session.kernel;
      const registerClosure = (targetName: string, callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void): IDisposable => {
        if (kernel == undefined) {
          console.log('Kernel not found, could not register comm target ', targetName);
          return;
        }
        return kernel.registerCommTarget(targetName, callback);
      };
      const connectClosure = (targetName: string, commId?: string): any => {
        if (kernel == undefined) {
          console.log('Kernel not found, could not connect to comm target ', targetName);
          return {open: function (): void {}, send: function (): void {}, onMsg: function (): void {}};
        }
        const comm_promise: Promise<Kernel.IComm> = kernel.connectToComm(targetName, commId);
        const sendClosure = (data: JSONValue, metadata?: JSONObject, buffers?: (ArrayBuffer | ArrayBufferView)[], disposeOnDone?: boolean): Promise<void> => {
          return comm_promise.then(function(comm: Kernel.IComm) {
            comm.send(data, metadata, buffers, disposeOnDone);
          });
        };
        const openClosure = (data?: JSONValue, metadata?: JSONObject, buffers?: (ArrayBuffer | ArrayBufferView)[]): Promise<void> => {
          return comm_promise.then(function(comm: Kernel.IComm) {
            comm.open(data, metadata, buffers);
          });
        };
        const comm_proxy: CommProxy = {
          set onMsg(callback: (msg: KernelMessage.ICommOpenMsg) => void) {
            comm_promise.then(function(comm: Kernel.IComm) {
              comm.onMsg = callback;
            })
          },
          open: openClosure,
          send: sendClosure};
        return comm_proxy;
      }
      const kernel_proxy: KernelProxy = {
        connectToComm: connectClosure,
        registerCommTarget: registerClosure
      };
      (window as any).HoloViews.kernels[id] = kernel_proxy;
      this._document_id = id;
      manager.context.session.statusChanged.connect((session: IClientSession, status: string) => {
        if (status == "restarting") {
          delete (window as any).HoloViews.kernels[String(metadata.id)];
          manager.comm = null;
        }
      });
    }
    this.node.appendChild(this._script_element)

    return Promise.resolve().then(function() {
      if (((window as any).Bokeh !== undefined) && (id in (window as any).Bokeh.index)) {
        (window as any).HoloViews.plot_index[id] = (window as any).Bokeh.index[id];
      } else {
        (window as any).HoloViews.plot_index[id] = null;
      }
    });
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    const id = this._document_id;
    if (id !== null) {
      if (this._manager.comm !== null) {
        this._manager.comm.then(function(comm: Kernel.IComm) {
          comm.send({event_type: "delete", "id": id});
        });
      }
      if (((window as any).HoloViews !== undefined) && ((window as any).HoloViews.kernels !== undefined)) {
        delete (window as any).HoloViews.kernels[id];
      }
      if (((window as any).Bokeh !== undefined) && (id in (window as any).Bokeh.index)) {
        (window as any).Bokeh.index[id].model.document.clear();
        delete (window as any).Bokeh.index[id];
      }
      this._document_id = null;
    }
    delete (window as any).HoloViews.plot_index[id];
    this._manager = null;
  }
}
