#!/usr/bin/env python

import os
import json

try:
    from setuptools import setup
except ImportError:
    from distutils.core import setup

HERE = os.path.abspath(os.path.dirname(__file__))

# The name of the project
name = "pyviz_comms"

# Get our version
with open(os.path.join(HERE, 'package.json')) as f:
    version = json.load(f)['version'].replace('-', '')

lab_path = os.path.join(HERE, name, "labextension")

# Representative files that should exist after a successful build
jstargets = [
    os.path.join(lab_path, "package.json"),
]

package_data_spec = {
    name: [
        "*"
    ]
}

labext_name = '@pyviz/jupyterlab_pyviz'

data_files_spec = [
    ("share/jupyter/labextensions/%s" % labext_name, lab_path, "**"),
    ("share/jupyter/labextensions/%s" % labext_name, HERE, "install.json"),
]

try:
    from jupyter_packaging import (
        create_cmdclass, install_npm, ensure_targets,
        combine_commands, skip_if_exists
    )


    cmdclass = create_cmdclass(
        "jsdeps",
        package_data_spec=package_data_spec,
        data_files_spec=data_files_spec
    )

    js_command = combine_commands(
        install_npm(HERE, build_cmd="build:prod", npm=["jlpm"]),
        ensure_targets(jstargets),
    )

    is_repo = os.path.exists(os.path.join(HERE, ".git"))
    if is_repo:
        cmdclass["jsdeps"] = js_command
    else:
        cmdclass["jsdeps"] = skip_if_exists(jstargets, js_command)
except:
    cmdclass = {}

extras_require = {
    'tests': ['flake8', 'nose'], # nose required due to pip_on_conda
    'build': [
        'setuptools',
        'jupyterlab ~=3.0',
        'jupyter-packaging ~=0.7.9',
        'twine',
        'rfc3986',
        'keyring'
    ]
}

extras_require['all'] = sorted(set(sum(extras_require.values(), [])))

with open("README.md", "r") as fh:
    long_description = fh.read()

install_requires = ['param']

setup_args = dict(
    name=name,
    version=version,
    install_requires=install_requires,
    extras_require=extras_require,
    tests_require=extras_require['tests'],
    description='Bidirectional communication for the HoloViz ecosystem.',
    long_description=long_description,
    long_description_content_type="text/markdown",
    cmdclass=cmdclass,
    author="Philipp Rudiger",
    author_email= "philipp.jfr@gmail.com",
    maintainer= "HoloViz",
    maintainer_email= "developers@pyviz.org",
    platforms=['Windows', 'Mac OS X', 'Linux'],
    license='BSD',
    url='https://holoviz.org',
    packages = ["pyviz_comms"],
    include_package_data=True,
    classifiers = [
        "License :: OSI Approved :: BSD License",
        "Development Status :: 5 - Production/Stable",
        "Programming Language :: Python :: 2.7",
        "Programming Language :: Python :: 3.3",
        "Programming Language :: Python :: 3.4",
        "Operating System :: OS Independent",
        "Intended Audience :: Science/Research",
        "Intended Audience :: Developers",
        "Natural Language :: English",
        "Topic :: Scientific/Engineering",
        "Topic :: Software Development :: Libraries"]
)

if __name__=="__main__":
    setup(**setup_args)
