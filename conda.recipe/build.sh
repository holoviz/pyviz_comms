#!/bin/bash

python setup.py --quiet install --single-version-externally-managed --record record.txt
mkdir -p $PREFIX/share/jupyter/labextensions/@pyviz/jupyter_pyviz
cp -r $SRC_DIR/pyviz_comms/labextension/* $PREFIX/share/jupyter/labextensions/@pyviz/jupyter_pyviz/
cp $RECIPE_DIR/install.json $PREFIX/share/jupyter/labextensions/@pyviz/jupyter_pyviz/
