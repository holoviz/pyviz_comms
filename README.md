# pyviz_comms

Offers a simple bidirectional communication architecture for PyViz tools
including support for Jupyter comms in both the classic notebook and
Jupyterlab.

There are two installable components in this repository: a Python
component used by various PyViz tools and an extension to enable
Jupyterlab support.

## Installing the Jupyterlab extension

Jupyterlab users will need to install the Jupyterlab pyviz extension:

```bash
jupyter labextension install @pyviz/jupyterlab_pyviz
```

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

The ``pyviz_comms`` Python package is used by pyviz projects and can be
pip and conda installed.
