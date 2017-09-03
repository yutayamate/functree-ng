FROM python:3.6

LABEL maintainer="Yuta Yamate <yyamate@bio.titech.ac.jp>"

RUN curl https://nodejs.org/dist/v6.11.2/node-v6.11.2-linux-x64.tar.xz | tar Jxv -C /opt/
ENV PATH /opt/node-v6.11.2-linux-x64/bin:$PATH

ADD . /app/
WORKDIR /app/

RUN pip3 install -r requirements.txt
RUN npm install --global yarn && \
  yarn install && \
  yarn run bower install && \
  yarn run build