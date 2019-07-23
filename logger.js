var amqp = require('amqplib');

var config = require('./config.json');

var get = {
    conn: null,
    ch  : null
};

function checkConfigParams(config) {
    if (!config) {
        console.log("Please create config.json file and configure parameters in this file (see README file)");
        return false;
    }

    // uriGet and exchanges are required parameters and has no default settings

    if (!config.uriGet) {
        console.log("Please set uriGet parameter in config.json to your 'master' RabbitMQ connect URI");
        return false;
    }
    if (!config.exchanges) {
        console.log("Please define exchanges in config.json");
        return false;
    }

    // queueName and queueOptions are optional and has default settings

    if (!config.queueName) {
        config.queueName = 'logger';
    }

    if (typeof config.queueOptions === 'string') {
        if (config[config.queueOptions]) {
            config.queueOptions = config[config.queueOptions];
        } else {
            console.log("queueOptions parameter is set to '"+ config.queueOptions +"' profile which is not defined in config.json. Falling back to default queueOptions settings.");
            config.queueOptions = null;
        }
    }
    if (!config.queueOptions) {
        config.queueOptions = { // default options
            exclusive: true
        }
    }

    return true;
}

function main(config) {
    console.log('RabbitMQ Logger v0.1.0 (https://github.com/structinfo/rabbit-logger)');

    if (!checkConfigParams(config)) return;

    console.log('Connecting to RabbitMQ', config.uriGet)
    amqp.connect(config.uriGet).then(function(conn) {
        get.conn = conn;
        console.log('Creating source channel');
        return conn.createChannel();
    }).then(function(ch){
        get.ch = ch;
        console.log('Set prefetch 1 on source channel');
        return ch.prefetch(1);
    }).then(function(){
        console.log('Asserting source queue', config.queueName);
        return get.ch.assertQueue(config.queueName, config.queueOptions);
    }).then(function(){
        console.log('Checking and binding all exchanges');
        var p = Promise.resolve();
        config.exchanges.forEach(function(exchangeGet) {
            p = p.then(function(){
                console.log('Checking source exchange', exchangeGet);
                return get.ch.checkExchange(exchangeGet);
            }).then(function(){
                console.log('Binding source queue', config.queueName, 'to source exchange', exchangeGet);
                return get.ch.bindQueue(config.queueName, exchangeGet, '#');
            }).then(function(){
                console.log('Installing message consumer to source queue', config.queueName);
                return get.ch.consume(config.queueName, function(message) {
                    console.log('Message from exchange [', message.fields.exchange, '] routing key [', message.fields.routingKey,']:', message.content.toString('utf8'));
                    return get.ch.ack(message);
                })
            }).then(function(){}).catch(function(err){
                console.log('Error binding exchanges', err);
            })
        })
        return p;
    }).then(function(){
        console.log('Successfully inited');
    }).catch(function(err){
        console.log('Error initing', err);
    })
}

// process.once('SIGINT', ()=>connection1.close())

main(config);
