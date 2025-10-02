"""
Setup script for LumiNote Voice-to-Text Transcription System.

This script handles the installation of the LumiNote application
as a Python package, making it easier to install and manage
dependencies.
"""

from setuptools import setup, find_packages
import os

# Read the contents of the README file for long description
def read_readme():
    with open("README.md", "r", encoding="utf-8") as fh:
        return fh.read()

# Read the contents of the requirements file
def read_requirements():
    with open("requirements.txt", "r", encoding="utf-8") as fh:
        return [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="luminote",
    version="1.0",
    author="Rak X Dev.",
    author_email="rakxdev@example.com",
    description="Advanced Voice-to-Text Transcription System",
    long_description=read_readme(),
    long_description_content_type="text/markdown",
    url="https://github.com/rakxdev/luminote",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Environment :: Web Environment",
        "Framework :: Flask",
        "Intended Audience :: End Users/Desktop",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Multimedia :: Sound/Audio :: Capture/Recording",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Text Processing :: Linguistic",
        "Topic :: Utilities",
    ],
    python_requires=">=3.7",
    install_requires=read_requirements(),
    entry_points={
        "console_scripts": [
            "luminote=app:main",  # This won't work directly, but shows the concept
        ],
    },
    include_package_data=True,
    zip_safe=False,
    data_files=[
        ("", ["LICENSE", "README.md", "requirements.txt"]),
    ],
)
