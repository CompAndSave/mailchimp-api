#! /bin/bash

ls -al
ls -al $CODEBUILD_SRC_DIR/target/$env
npm install -g serverless
serverless deploy --stage $env --package $CODEBUILD_SRC_DIR/target/$env -v