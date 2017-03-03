import chalk from "chalk";
import {execSync, spawn} from "child_process";
import path from "path";

class DiscordProcess {
    constructor(process) {
        this.process = process;
    }
    
    kill() {
        console.log(chalk.blue(`Killing "${this.process.exe}" Process`));
        
        switch (true) {
            case process.platform !== "win32":
                return execSync(`kill ${this.process.pid}`);
            default:
                throw new Error("Platform not supported");
        }
    }
    
    launch() {
        console.log(chalk.green("Launching Discord: " + path.join(this.process.path, this.process.exe)));
        switch (true) {
            case process.platform === 'darwin':
                return spawn("open", [path.join(this.process.path, this.process.exe)], {stdio: 'ignore'});
            default:
                return spawn(path.join(this.process.path, this.process.exe), {stdio: 'ignore'});
        }
    }
    
    
    /*
     * OS X has a different resources path
     * Application directory is under <[EXE].app/Contents/MacOS/[EXE]>
     * where [EXE] is Discord Canary, Discord PTB, etc
     * Resources directory is under </Applications/[EXE].app/Contents/Resources/app.asar>
     * So we need to fetch the folder based on the executable path.
     */
    getResourcePath() {
        switch (true) {
            case process.platform === 'darwin':
                return path.join(this.process.path, this.process.exe, 'Contents', 'Resources');
            default:
                return path.join(this.process.path, 'resources');
        }
    }
}

module.exports = DiscordProcess;