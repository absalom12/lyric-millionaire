#!/bin/bash
# Pitch Intelligence — one-time setup on Mac
# Run: bash setup.sh

set -e

echo "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "Setup complete."
echo ""
echo "To activate the environment next time:"
echo "  source venv/bin/activate"
echo ""
echo "To launch the notebook:"
echo "  jupyter lab notebooks/psg_transfer_intelligence.ipynb"
