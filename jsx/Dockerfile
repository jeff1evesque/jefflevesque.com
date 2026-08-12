FROM node:12.11.1

## local variables
ENV ROOT_PROJECT /var/app

## source + asset directory
RUN mkdir -p $ROOT_PROJECT/src/jsx $ROOT_PROJECT/static/js
COPY . $ROOT_PROJECT/src/jsx/

## provision with package.json
WORKDIR $ROOT_PROJECT/src/jsx/
RUN npm install

## define entrypoint script
RUN printf "#!/bin/bash\n\n\
npm run prebuild:dos2unix\n\
npm run build:browserify\n\
npm run watch:jsx\n\
" > $ROOT_PROJECT/src/jsx/entrypoint
RUN chmod 710 $ROOT_PROJECT/src/jsx/entrypoint

## executed everytime container starts
ENTRYPOINT ["/bin/bash", "-c", "./entrypoint"]
