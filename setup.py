#!/usr/bin/env python

import sys, os
try:
    from setuptools import setup
except ImportError:
    from distutils.core import setup

install_requires = []
setup_args = {}
setup_args.update(dict(
    name='pyviz_comms',
    version="0.1.0",
    install_requires = install_requires,
    description='Launch jobs, organize the output, and dissect the results.',
    long_description=open('README.md').read() if os.path.isfile('README.md') else 'Consult README.md',
    long_description_content_type="text/markdown",
    author= "PyViz developers",
    author_email= "",
    maintainer= "PyViz",
    maintainer_email= "holoviews@gmail.com",
    platforms=['Windows', 'Mac OS X', 'Linux'],
    license='BSD',
    url='http://pyviz.org',
    packages = ["pyviz_comms"],
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
))


if __name__=="__main__":
    setup(**setup_args)
