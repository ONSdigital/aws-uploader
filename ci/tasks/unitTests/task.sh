#!/bin/bash
set -e

cd repo-git
npm install
npm run test:unit
