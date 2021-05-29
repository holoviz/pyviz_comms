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

import { INotebookModel } from '@jupyterlab/notebook';

import { refreshIcon } from '@jupyterlab/ui-components';

import { Token } from '@lumino/coreutils';

import { Signal } from '@lumino/signaling';

import * as React from 'react';

import { panelIcon } from './icons';

/**
 * A class that tracks Panel Preview widgets.
 */
export interface IPanelPreviewTracker extends IWidgetTracker<PanelPreview> {}

/**
 * The Panel Preview tracker token.
 */
export const IPanelPreviewTracker = new Token<IPanelPreviewTracker>(
  '@pyviz/jupyterlab_pyviz:IPanelPreviewTracker'
);

/**
 * A DocumentWidget that shows a Panel preview in an IFrame.
 */
export class PanelPreview extends DocumentWidget<IFrame, INotebookModel> {
  /**
   * Instantiate a new PanelPreview.
   * @param options The PanelPreview instantiation options.
   */
  constructor(options: PanelPreview.IOptions) {
    super({
      ...options,
      content: new IFrame({
        sandbox: ['allow-same-origin', 'allow-scripts', 'allow-downloads']
      })
    });

    window.onmessage = (event: any) => {
      switch (event.data?.level) {
        case 'debug':
          console.debug(...event.data?.msg);
          break;

        case 'info':
          console.info(...event.data?.msg);
          break;

        case 'warn':
          console.warn(...event.data?.msg);
          break;

        case 'error':
          console.error(...event.data?.msg);
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
      onClick: () => {
        this.reload();
      }
    });

    const renderOnSaveCheckbox = ReactWidget.create(
      <label className="jp-PanelPreview-renderOnSave">
        <input
          style={{ verticalAlign: 'middle' }}
          name="renderOnSave"
          type="checkbox"
          defaultChecked={renderOnSave}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            this._renderOnSave = event.target.checked;
          }}
        />
        Render on Save
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
    if (iframe.contentWindow) {
      iframe.contentWindow.location.reload();
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
    extends DocumentWidget.IOptionsOptionalContent<IFrame, INotebookModel> {
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
  INotebookModel
> {
  defaultRenderOnSave = false;

  constructor(
    private getPanelUrl: (path: string) => string,
    options: DocumentRegistry.IWidgetFactoryOptions<PanelPreview>
  ) {
    super(options);
  }

  protected createNewWidget(
    context: DocumentRegistry.IContext<INotebookModel>
  ): PanelPreview {
    return new PanelPreview({
      context,
      getPanelUrl: this.getPanelUrl,
      renderOnSave: this.defaultRenderOnSave
    });
  }
}
