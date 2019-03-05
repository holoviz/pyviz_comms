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
  open(data?: JSONValue, metadata?: JSONObject, buffers?: (ArrayBuffer | ArrayBufferView)[]): void,
  send(data: JSONValue, metadata?: JSONObject, buffers?: (ArrayBuffer | ArrayBufferView)[], disposeOnDone?: boolean): void,
  onMsg: (msg: KernelMessage.ICommOpenMsg) => void
}

export declare interface KernelProxy {
  // copied from https://github.com/jupyterlab/jupyterlab/blob/master/packages/services/src/kernel/default.ts#L605
  registerCommTarget(targetName: string, callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void): void,
  connectToComm(targetName: string, commId?: string): CommProxy,
}

/**
 * The MIME types for PyViz
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
  private _dispose: boolean
  private _document_id: string
  private _server_id: string
  private _exec_mimetype: string = HV_EXEC_MIME_TYPE
  private _script_element: HTMLScriptElement
  private _div_element: HTMLDivElement
  private _manager: ContextManager;
  private _displayed: boolean;

  constructor(options: IRenderMime.IRendererOptions, manager: ContextManager) {
    super()
    this._createNodes();
    this._manager = manager
    this._displayed = false;
    this._dispose = true;
  }

  _createNodes(): void {
    this._div_element = document.createElement("div")
    this._script_element = document.createElement("script")
    this._script_element.setAttribute('type', 'text/javascript');
  }

  get isDisposed(): boolean {
    return this._manager === null;
  }

  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    let metadata = model.metadata[this._exec_mimetype] as ReadonlyJSONObject
    const id = metadata.id as string;
    if (this._displayed) {
      this._disposePlot()
      this.node.removeChild(this._div_element);
      this.node.removeChild(this._script_element);
      this._createNodes()
    }
    this._dispose = true;
    if (id !== undefined) {
      // I'm a static document
      if ((window as any).PyViz === undefined) {
        (window as any).PyViz = {kernels: {}};
      }
      (window as any).PyViz.init_slider = init_slider;
      (window as any).PyViz.init_dropdown = init_dropdown;

      const html_data = model.data[this._html_mimetype] as string;
      this._div_element.innerHTML = html_data;
      this.node.appendChild(this._div_element);

      let data = model.data[this._js_mimetype] as string;
      this._script_element.textContent = data;
      this.node.appendChild(this._script_element);

      this._displayed = true;

      const manager = this._manager;
      const kernel = manager.context.session.kernel;
      const registerClosure = (targetName: string, callback: (comm: Kernel.IComm, msg: KernelMessage.ICommOpenMsg) => void): void => {
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
        const comm: Kernel.IComm = kernel.connectToComm(targetName, commId);
        const sendClosure = (data: JSONValue, metadata?: JSONObject, buffers?: (ArrayBuffer | ArrayBufferView)[], disposeOnDone?: boolean): void => {
          comm.send(data, metadata, buffers, disposeOnDone);
        };
        const openClosure = (data?: JSONValue, metadata?: JSONObject, buffers?: (ArrayBuffer | ArrayBufferView)[]): void => {
          comm.open(data, metadata, buffers);
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
      (window as any).PyViz.kernels[id] = kernel_proxy;
      this._document_id = id;
      manager.context.session.statusChanged.connect((session: IClientSession, status: Kernel.Status) => {
        if (status == "restarting" || status === "dead") {
          delete (window as any).PyViz.kernels[id];
          this._dispose = false;
          manager.comm = null;
        }
      });
    } else if (metadata.server_id !== undefined) {
      // I'm a server document
      this._server_id = metadata.server_id as string
      const data = model.data[this._html_mimetype] as string
      const d = document.createElement('div')
      d.innerHTML = data
      const script_attrs: NamedNodeMap = d.children[0].attributes
      for (const i in script_attrs) {
        this._script_element.setAttribute(script_attrs[i].name, script_attrs[i].value)
      }
      this.node.appendChild(this._script_element)
    }
    return Promise.resolve().then(function() {
      if (((window as any).Bokeh !== undefined) && (id in (window as any).Bokeh.index)) {
        (window as any).PyViz.plot_index[id] = (window as any).Bokeh.index[id];
      } else {
        (window as any).PyViz.plot_index[id] = null;
      }
    });
  }

  _disposePlot(): void {
    if (this._server_id) {
      if ((this._manager.comm !== null) && this._dispose) {
        this._manager.comm.send({event_type: "server_delete", "id": this._server_id});
      }
      this._server_id = null
    } else if (this._document_id) {
      const id = this._document_id;
      if ((this._manager.comm !== null) && this._dispose) {
        this._manager.comm.send({event_type: "delete", "id": id});
      }
      if (((window as any).PyViz !== undefined) && ((window as any).PyViz.kernels !== undefined)) {
        delete (window as any).PyViz.kernels[id];
      }
      if (((window as any).Bokeh !== undefined) && (id in (window as any).Bokeh.index)) {
        var doc: any = (window as any).Bokeh.index[id].model.document
        doc.clear();
        const i = (window as any).Bokeh.documents.indexOf(doc);
        if (i > -1) {
          (window as any).Bokeh.documents.splice(i, 1);
        }
      }
      this._document_id = null;
      delete (window as any).PyViz.plot_index[id];
    }
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._disposePlot();
    this._manager = null;
  }
}
