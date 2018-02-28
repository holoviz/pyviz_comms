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
import 'jquery-ui-bundle'

export declare interface CommProxy {
  open(data?: JSONValue, metadata?: JSONObject, buffers?: (ArrayBuffer | ArrayBufferView)[]): Kernel.IFuture,
  send(data: JSONValue, metadata?: JSONObject, buffers?: (ArrayBuffer | ArrayBufferView)[], disposeOnDone?: boolean): Kernel.IFuture,
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
  private _server_id: string
  private _manager: ContextManager;

  constructor(options: IRenderMime.IRendererOptions, manager: ContextManager) {
    super()
    this._script_element = document.createElement("script")
    this._manager = manager
  }

  get isDisposed(): boolean {
    return this._manager === null;
  }

  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    let metadata = model.metadata[this._exec_mimetype] as ReadonlyJSONObject

    if (metadata.id !== undefined) {
      // I'm a static document
      if ((window as any).HoloViews === undefined) {
        (window as any).HoloViews = {kernels: {}};
      }
      (window as any).HoloViews.init_slider = init_slider;
      (window as any).HoloViews.init_dropdown = init_dropdown;
      let data = model.data[this._js_mimetype] as string;
      this._script_element.textContent = data;
      const kernel = this._manager.context.session.kernel;
      const registerClosure = (targetName: string, callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void): IDisposable => {
        return kernel.registerCommTarget(targetName, callback);
      };
      const connectClosure = (targetName: string, commId?: string): CommProxy => {
        const comm: Kernel.IComm = kernel.connectToComm(targetName, commId);
        const sendClosure = (data: JSONValue, metadata?: JSONObject, buffers?: (ArrayBuffer | ArrayBufferView)[], disposeOnDone?: boolean): Kernel.IFuture => {
          return comm.send(data, metadata, buffers, disposeOnDone);
        };
        const openClosure = (data?: JSONValue, metadata?: JSONObject, buffers?: (ArrayBuffer | ArrayBufferView)[]): Kernel.IFuture => {
          return comm.open(data, metadata, buffers);
        };
        const comm_proxy: CommProxy = {
          set onMsg(callback: (msg: KernelMessage.ICommOpenMsg) => void) {
            comm.onMsg = callback;
          },
          open: openClosure,
          send: sendClosure};
        return comm_proxy;
      }
      const kernel_proxy: KernelProxy = {
        connectToComm: connectClosure,
        registerCommTarget: registerClosure
      };
      (window as any).HoloViews.kernels[String(metadata.id)] = kernel_proxy;
      this._document_id = metadata.id as string;
      this._manager.context.session.statusChanged.connect((session: IClientSession, status: string) => {
        if (status == "restarting") {
          delete (window as any).HoloViews.kernels[String(metadata.id)];
        }
      });
    } else if (metadata.server_id !== undefined) {
      // I'm a server document
      this._server_id = metadata.server_id as string
      let data = model.data[this._html_mimetype] as string
      const d = document.createElement('div')
      d.innerHTML = data
      const script_attrs: NamedNodeMap = d.children[0].attributes
      for (let i in script_attrs) {
        this._script_element.setAttribute(script_attrs[i].name, script_attrs[i].value)
      }
    }
    this.node.appendChild(this._script_element)
    return Promise.resolve()
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    if (this._server_id) {
      let content: KernelMessage.IExecuteRequest = {
        code: `import bokeh.io.notebook as ion; ion.destroy_server('${this._server_id}')`
      }
      this._manager.context.session.kernel.requestExecute(content, true)
      this._server_id = null
    } else if (this._document_id) {
      if (((window as any).HoloViews !== undefined) && ((window as any).HoloViews.kernels !== undefined)) {
        delete (window as any).HoloViews.kernels[this._document_id];
      }
      this._document_id = null;
    }
    this._manager = null;
  }
}
