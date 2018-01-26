import Assistant from './lib/assistant';

const assistant = new Assistant();

assistant.on('ready', () => {
    assistant.start().then((conv) => {
        console.log('here');
    }).catch((err) => {
        console.log(err);
    });
})