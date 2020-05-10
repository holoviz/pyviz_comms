# pyviz_comms

Offers a simple bidirectional communication architecture between Python and JavaScript, 
with support for Jupyter comms in both the classic notebook and Jupyterlab.
Available for use by any [PyViz](https://pyviz.org) tool, but currently primarily used by
[HoloViz](https://holoviz.org) tools.

There are two installable components in this repository: a Python
component used by various HoloViz tools and an extension to enable
Jupyterlab support.

## Installing the Jupyterlab extension

Jupyterlab users will need to install the Jupyterlab pyviz extension:

```bash
jupyter labextension install @pyviz/jupyterlab_pyviz
```

## Compatibility

The [Holoviz](https://github.com/holoviz/holoviz) libraries are generally version independent of
[JupyterLab](https://github.com/jupyterlab/jupyterlab) and the ``jupyterlab_pyviz`` extension
has been supported since holoviews 1.10.0 and the first release of ``pyviz_comms``.

Our goal is that ``jupyterlab_pyviz`` minor releases (using the [SemVer](https://semver.org/) pattern) are
made to follow JupyterLab minor release bumps and micro releases are for new ``jupyterlab_pyviz`` features
or bug fix releases. We've been previously inconsistent with having the extension release minor version bumps
track that of JupyterLab, so users seeking to find extension releases that are compatible with their JupyterLab
installation may refer to the below table.

###### Compatible JupyterLab and jupyterlab_pyviz versions

| JupyterLab    | jupyterlab_pyviz |
| ------------- | ---------------- |
| 0.33.x        | 0.6.0            |
| 0.34.x        | 0.6.1-0.6.2      |
| 0.35.x        | 0.6.3-0.7.2      |
| 1.0.x         | 0.8.0            |
| 2.0.x         | 0.9.0-1.0.3      |

## Developing the Jupyterlab extension

For a development install (requires npm version 4 or later), do the following in the repository directory:

```bash
npm install
jupyter labextension link .
```

To rebuild the package and the JupyterLab app:

```bash
npm run build
jupyter lab build
```

## The ``pyviz_comms`` Python package

The ``pyviz_comms`` Python package is used by holoviz projects and can be
pip and conda installed.
