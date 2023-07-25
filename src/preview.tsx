import {
  IFrame,
  ToolbarButton,
  ReactWidget,
  IWidgetTracker
} from '@jupyterlab/apputils';

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
}

export class CustomIFrame extends IFrame {
  constructor(options: IOptions = {}) {
    super(options);
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
      iframe.addEventListener('load', () => iframe.removeAttribute('srcdoc'));
    }
  }

  private _srcdoc!: string | null;
}

const CUSTOM_LOADER = `
<!DOCTYPE html>
<html>
<head>
  <title>Jupyter Kernel Starting</title>
  <style>
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      height: 100vh;
      background-color: #f7f7f7;
      font-family: Futura;
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
    super({
      ...options,
      content: new CustomIFrame({
        srcdoc: CUSTOM_LOADER,
        sandbox: ['allow-same-origin', 'allow-scripts', 'allow-downloads']
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

    this.content.url = getPanelUrl(context.path);
    this.content.title.icon = panelIcon;

    this._renderOnSave = renderOnSave ?? false;

    context.pathChanged.connect(() => {
      this.content.url = getPanelUrl(context.path);
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
