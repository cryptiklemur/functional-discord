window._fs          = require("fs");

window._fileWatchers = {css: null, js: null};
window._tags = {css: null, js: null};

window.setup = function (type, path) {
    const custom = window._fs.readFileSync(path, "utf-8");
    if (window._tags[type] === null) {
        window._tags[type] = document.createElement(type === "css" ? "style" : "script");
        if (type === 'css') {
            window._tags[type].rel = "stylesheet";
        } else {
            window._tags[type].type = "application/javascript";
        }
        
        document.head.appendChild(window._tags[type]);
    }
    
    window._tags[type].innerHTML = custom;
    if (!window._fileWatchers[type]) {
        window._fileWatchers[type] = window._fs.watch(path, {encoding: "utf-8"},
            function (eventType) {
                if (eventType === "change") {
                    console.log(path + " changed, updating " + type);
                    //window._tags[type].innerHTML = window._fs.readFileSync(path, "utf-8").toString();
                    window.tearDown(type);
                    window.setup(type, path);
                }
            }
        );
    }
    
    console.log("Now accepting custom " + type);
};

window.tearDown = function (type) {
    if (!!window._tags[type]) {
        window._tags[type].innerHTML = "";
    }
    if (!!window._fileWatchers[type]) {
        window._fileWatchers[type].close();
        window._fileWatchers[type] = null;
    }
};

window.applyAndWatch = function (css, js) {
    window.tearDown("css");
    window.tearDown("js");
    
    window.setup("css", css);
    window.setup("js", js);
};
window.applyAndWatch("{0}", "{1}");
