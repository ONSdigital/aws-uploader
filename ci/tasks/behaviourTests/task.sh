#!/bin/sh

cd repo-git
sudo apt update -y
sudo apt install npm -y
sudo npm install
npm test
