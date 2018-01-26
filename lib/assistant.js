'use strict';

import { EventEmitter } from 'events';
import _ from 'lodash';
import GoogleAssistant from 'google-assistant';
import path from 'path';
import Promise from 'bluebird';
const appRoot = require('app-root-path').toString();


const Defaults = {
    auth: {
        keyFilePath: path.resolve(appRoot, 'client_secret.json'),
        // where you want the tokens to be saved
        // will create the directory if not already there
        savedTokensPath: path.resolve(appRoot, 'tokens.json'),
    },
    // this param is optional, but all options will be shown
    conversation: {
        audio: {
            encodingIn: 'LINEAR16', // supported are LINEAR16 / FLAC (defaults to LINEAR16)
            sampleRateIn: 16000, // supported rates are between 16000-24000 (defaults to 16000)
            encodingOut: 'MP3', // supported are LINEAR16 / MP3 / OPUS_IN_OGG (defaults to LINEAR16)
            sampleRateOut: 24000, // supported are 16000 / 24000 (defaults to 24000)
        },
        lang: 'en-US', // language code for input/output (defaults to en-US)
        //deviceModelId: 'xxxxxxxx', // use if you've gone through the Device Registration process
        //deviceId: 'xxxxxx', // use if you've gone through the Device Registration process
    },
    autostart: false,
    alwaysContinue: true,
};

export default class Assistant extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = _.defaultsDeep({}, options, Defaults);
        this.assistant = new GoogleAssistant(this.options.auth)
            .on('ready', () => this.onReady())
            .on('error', (err) => this.onError(err));
    }

    startedConversation(conversation) {
        conversation
            .on('audio-data', (data) => {
                // do stuff with the audio data from the server
                // usually send it to some audio output / file
                this.emit('audio-data', data);
            })
            .on('end-of-utterance', () => {
                // do stuff when done speaking to the assistant
                // usually just stop your audio input
                this.emit('end-of-utterance');
            })
            .on('transcription', (data) => {
                // do stuff with the words you are saying to the assistant
                this.emit('transcription', data);
            })
            .on('response', (text) => {
                // do stuff with the text that the assistant said back
                this.emit('response', text);
            })
            .on('volume-percent', (percent) => {
                // do stuff with a volume percent change (range from 1-100)
                this.emit('volume-percent', percent);
            })
            .on('device-action', (action) => {
                // if you've set this device up to handle actions, you'll get that here
                this.emit('device-action', action);
            })
            .on('ended', (error, continueConversation) => {
                // once the conversation is ended, see if we need to follow up
                if (error) return this.onError(error);
                else if (continueConversation || this.options.alwaysContinue) {
                    this.assistant.start()
                } else {
                    this.emit('ended');
                }
            })
            .on('error', (error) => this.onError(error));

        this.emit('started', conversation);
    }

    onError(error) {
        this.emit('error', error);
        console.log(error);
    }

    onReady() {
        this.ready = true;
        this.emit('ready', ...arguments);
        if (this.options.autostart) {
            this.start();
        }
    }


    start(options = {}) {
        options = _.defaults({}, options, this.options.conversation);
        return new Promise((resolve, reject) => {
            const onStartedEventOnced = _.once((conv) => {
                this.startedConversation(conv);
                resolve(conv);
                this.assistant.off('error', onErrorOnced);
                this.assistant.off('start', onStartedEventOnced);
            });
            const onErrorOnced = _.once((error) => {
                this.onError(error);
                reject(error);
                this.assistant.off('error', onErrorOnced);
                this.assistant.off('start', onStartedEventOnced);
            });
            this.assistant.on('started', onStartedEventOnced).on('error', onErrorOnced);
            if (this.ready) {
                this.assistant.start(options);
            } else if (!this.options.autostart) {
                this.assistant.on('ready', () => this.start());
            }
        });
    }
}