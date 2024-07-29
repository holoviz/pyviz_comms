import {
  IFrame,
  ToolbarButton,
  ReactWidget,
  IWidgetTracker
} from '@jupyterlab/apputils';

import { PageConfig } from '@jupyterlab/coreutils';

import { ServerConnection } from '@jupyterlab/services';

import {
  ABCWidgetFactory,
  DocumentRegistry,
  DocumentWidget
} from '@jupyterlab/docregistry';

import { refreshIcon } from '@jupyterlab/ui-components';

import { Token } from '@lumino/coreutils';

import { Signal } from '@lumino/signaling';

import * as React from 'react';

import { panelIcon } from './icons';

import panelSvgStr from '../style/panel.svg';

/**
 * A class that tracks Panel Preview widgets.
 */
export type IPanelPreviewTracker = IWidgetTracker<PanelPreview>;

/**
 * The Panel Preview tracker token.
 */
export const IPanelPreviewTracker = new Token<IPanelPreviewTracker>(
  '@pyviz/jupyterlab_pyviz:IPanelPreviewTracker'
);

export interface IOptions extends IFrame.IOptions {
  srcdoc?: string | null;
  clearSrcDocOnLoad?: boolean;
}

export class CustomIFrame extends IFrame {
  constructor(options: IOptions = {}) {
    super(options);
    this._clearSrcDocOnLoad = options.clearSrcDocOnLoad || false;
    this.srcdoc = options.srcdoc || null;
  }

  get srcdoc() {
    return this._srcdoc;
  }

  set srcdoc(value: string | null) {
    this._srcdoc = value;
    const iframe = this.node.querySelector('iframe')!;
    if (value !== null) {
      iframe.setAttribute('srcdoc', value);
      if (this._clearSrcDocOnLoad) {
        iframe.addEventListener('load', () => iframe.removeAttribute('srcdoc'));
      }
    }
  }

  get absoluteUrl() {
    const iframe = this.node.querySelector('iframe')!;
    return iframe.dataset.absoluteUrl ?? '';
  }

  set absoluteUrl(value: string) {
    const iframe = this.node.querySelector('iframe')!;
    iframe.dataset.absoluteUrl = value;
  }

  private _srcdoc!: string | null;
  private _clearSrcDocOnLoad: boolean;
}

const CUSTOM_LOADER = `
<!DOCTYPE html>
<html>
<head>
  <title>Jupyter Kernel Starting</title>
  <link href="https://fonts.googleapis.com/css2?family=Kumbh+Sans:wght@900&display=swap" rel="stylesheet">
  <style>
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      height: 100vh;
      background-color: #f7f7f7;
      font-family: "Kumbh Sans", "Segoe UI", Arial, Helvetica, sans-serif;
    }

    h1 {
      font-weight: 900;
    }

    .loading-container {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 20px 0;
    }

    .loading-indicator {
      width: 100px;
      height: 100px;
      border: 8px solid rgb(48, 112, 146);
      border-top-color: #f7f7f7;
      border-radius: 50%;
      animation: spin 1s infinite linear;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  </style>
</head>
<body>
  ${panelSvgStr}
  <h1>Panel Preview Launching...</h1>
  <div class="loading-container">
    <div class="loading-indicator"></div>
  </div>
</body>
</html>
`;

/**
 * A DocumentWidget that shows a Panel preview in an IFrame.
 */
export class PanelPreview extends DocumentWidget<
  CustomIFrame,
  DocumentRegistry.ICodeModel
> {
  /**
   * Instantiate a new PanelPreview.
   * @param options The PanelPreview instantiation options.
   */
  constructor(options: PanelPreview.IOptions) {
    const isJupyterHub = PageConfig.getOption('hubPrefix') !== '';
    super({
      ...options,
      content: new CustomIFrame({
        srcdoc: CUSTOM_LOADER,
        sandbox: ['allow-same-origin', 'allow-scripts', 'allow-downloads'],
        clearSrcDocOnLoad: !isJupyterHub
      })
    });

    window.onmessage = (event: any): void => {
      switch (event.data?.level) {
        case 'debug':
          console.debug(...(event.data?.msg || event));
          break;

        case 'info':
          console.info(...(event.data?.msg || event));
          break;

        case 'warn':
          console.warn(...(event.data?.msg || event));
          break;

        case 'error':
          console.error(...(event.data?.msg || event));
          break;

        default:
          console.log(event);
          break;
      }
    };

    const { getPanelUrl, context, renderOnSave } = options;

    const settings = ServerConnection.makeSettings();

    const populateIframe = async (path: string) => {
      const panelUrl = getPanelUrl(path);
      if (isJupyterHub && panelUrl.startsWith(settings.baseUrl)) {
        // if running on JupyterHub and the panel preview is served
        // from the same domain as JupyterHub, the CSP will forbid
        // embedding the page handled by JupyterHub in the iframe,
        // thus we need to set the content via the `srcdoc` attribute.
        const response = await ServerConnection.makeRequest(
          panelUrl,
          {},
          settings
        );
        this.content.srcdoc = await response.text();
        // Bokeh needs to know the absolute URL to determine the appropriate
        // protocol and URL for the websocket; this is set as a data attribute.
        this.content.absoluteUrl = panelUrl;
      } else {
        // this won't work in JupyterHub 4.1+ without relaxing CSP
        this.content.url = panelUrl;
      }
    };

    void populateIframe(context.path);
    this.content.title.icon = panelIcon;

    this._renderOnSave = renderOnSave ?? false;

    context.pathChanged.connect(async () => {
      await populateIframe(context.path);
    });

    const reloadButton = new ToolbarButton({
      icon: refreshIcon,
      tooltip: 'Reload Preview',
      onClick: (): void => {
        this.reload();
      }
    });

    const renderOnSaveCheckbox = ReactWidget.create(
      <label className="jp-PanelPreview-renderOnSave">
        <input
          name="renderOnSave"
          type="checkbox"
          defaultChecked={renderOnSave}
          onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
            this._renderOnSave = event.target.checked;
          }}
        />
        <span>Render on Save</span>
      </label>
    );

    this.toolbar.addItem('reload', reloadButton);

    if (context) {
      this.toolbar.addItem('renderOnSave', renderOnSaveCheckbox);
      void context.ready.then(() => {
        context.fileChanged.connect(() => {
          if (this.renderOnSave) {
            this.reload();
          }
        });
      });
    }
  }

  /**
   * Dispose the preview widget.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    super.dispose();
    Signal.clearData(this);
  }

  /**
   * Reload the preview.
   */
  reload(): void {
    const iframe = this.content.node.querySelector('iframe')!;
    if (iframe.contentWindow !== null) {
      iframe.parentElement?.classList.add('jp-PanelPreview-loading');
      iframe.contentWindow.location.reload();
      iframe.addEventListener('load', () => {
        iframe.parentElement?.classList.remove('jp-PanelPreview-loading');
      });
    }
  }

  /**
   * Get whether the preview reloads when the context is saved.
   */
  get renderOnSave(): boolean {
    return this._renderOnSave;
  }

  /**
   * Set whether the preview reloads when the context is saved.
   */
  set renderOnSave(renderOnSave: boolean) {
    this._renderOnSave = renderOnSave;
  }

  private _renderOnSave: boolean;
}

/**
 * A namespace for PanelPreview statics.
 */
export namespace PanelPreview {
  /**
   * Instantiation options for `PanelPreview`.
   */
  export interface IOptions
    extends DocumentWidget.IOptionsOptionalContent<
      IFrame,
      DocumentRegistry.ICodeModel
    > {
    /**
     * The Panel URL function.
     */
    getPanelUrl: (path: string) => string;

    /**
     * Whether to reload the preview on context saved.
     */
    renderOnSave?: boolean;
  }
}

export class PanelPreviewFactory extends ABCWidgetFactory<
  PanelPreview,
  DocumentRegistry.ICodeModel
> {
  defaultRenderOnSave = false;

  constructor(
    private getPanelUrl: (path: string) => string,
    options: DocumentRegistry.IWidgetFactoryOptions<PanelPreview>
  ) {
    super(options);
  }

  protected createNewWidget(
    context: DocumentRegistry.IContext<DocumentRegistry.ICodeModel>
  ): PanelPreview {
    return new PanelPreview({
      context,
      getPanelUrl: this.getPanelUrl,
      renderOnSave: this.defaultRenderOnSave
    });
  }
}
