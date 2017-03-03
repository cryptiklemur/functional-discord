import asar from "asar";
import chalk from "chalk";
import {execSync} from "child_process";
import fs from "fs";
import path from "path";
import ps from "current-processes";
import readline from "readline-sync";
import DiscordProcess from "./DiscordProcess";

function deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file) {
            const curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

const injectionScript = fs.readFileSync(path.join(__dirname, "./Injection.js")).toString();

class Main {
    static GetDefaultLocation() {
        switch (true) {
            case process.platform !== 'win32':
                return path.join(
                    execSync('echo ~').toString().replace(/[\r\n]/g, '').replace(/\s/g, "\\ "),
                    'functional_discord'
                );
            default:
                throw new Error("Platform not supported yet");
        }
    }
    
    constructor(program) {
        this.program = program;
    }
    
    async run() {
        try {
            let discord = await this.getDiscordProcess();
            
            discord.kill();
            
            if (this.program.revert) {
                try {
                    fs.rmdirSync(path.join(discord.getResourcePath(), "app"));
                    fs.renameSync(
                        path.join(discord.getResourcePath(), "original_app.asar"),
                        path.join(discord.getResourcePath(), "./app.asar")
                    );
                    console.log(chalk.green("Reverted changes."));
                } catch (error) {
                    console.log(chalk.yellow("No changes to revert"));
                }
                
                return discord.launch();
            }
            
            console.info(chalk.grey("Extracting asar"));
            if (!Main.extractAsar(discord)) {
                return discord.launch();
            }
            
            console.info(chalk.grey("Creating directories if necessary"));
            const scripts = path.join(this.program.location, 'scripts');
            const styles  = path.join(this.program.location, 'styles');
            for (let location of [this.program.location, scripts, styles]) {
                if (!fs.existsSync(location)) {
                    fs.mkdirSync(location);
                }
            }
            
            const appJs = path.join(scripts, 'app.js');
            if (!fs.existsSync(appJs)) {
                fs.writeFileSync(appJs, "/* put your custom js here. */\n");
            }
            
            const appCss = path.join(styles, 'app.css');
            if (!fs.existsSync(appCss)) {
                fs.writeFileSync(appCss, "/* put your custom css here. */\n");
            }
            
            const injectionFilename = path.join(discord.getResourcePath(), "app", "injection.js");
            fs.writeFileSync(
                injectionFilename,
                injectionScript.format(appCss.replace("\\", "\\\\"), appJs.replace("\\", "\\\\"))
            );
            
            const injectionPath = fs.realpathSync(injectionFilename).replace("\\", "\\\\");
            const reloadScript  = `mainWindow.webContents.on("dom-ready", function () {
    mainWindow.webContents.executeJavaScript(_fs2.default.readFileSync("${injectionPath}", "utf-8"));
});`;
            const indexContent  = fs.readFileSync(path.join(discord.getResourcePath(), "app", "index.js")).toString();
            fs.writeFileSync(
                path.join(discord.getResourcePath(), "app", "index.js"),
                indexContent.replace("mainWindow.webContents.on('dom-ready', function () {});", reloadScript)
            );
            
            console.log(
                "\n",
                chalk.green("Done!\n"),
                `You may now edit your scripts and styles in ${this.program.location} which will be reloaded whenever it's saved.\n`,
            );
            
            discord.launch();
        } catch (e) {
            throw e;
        }
    }
    
    /**
     *
     * @param {DiscordProcess} discord
     * @returns {boolean}
     */
    static extractAsar(discord) {
        const location = discord.getResourcePath();
        
        try {
            if (fs.existsSync(path.join(location, "app"))) {
                let response = readline.question("asar already extracted, overwrite? (Y/n): ");
                if (response.toLowerCase().startsWith("n")) {
                    console.log("Exiting.");
                    
                    return false;
                }
                
                deleteFolderRecursive(path.join(location, "app"));
                fs.renameSync(path.join(location, "original_app.asar"), path.join(location, "app.asar"));
            }
            
            console.log(chalk.red(`Extracting ${path.join(location, "app")} from ${path.join(location, "app.asar")}`));
            asar.extractAll(path.join(location, "app.asar"), path.join(location, "app"));
            fs.renameSync(path.join(location, "app.asar"), path.join(location, "original_app.asar"));
            
            return true;
        } catch (error) {
            throw error;
        }
    }
    
    /**
     *
     * @returns {Promise.<DiscordProcess>}
     */
    async getDiscordProcess() {
        try {
            let processes = await Promise.all((await this.getProcesses()).map(proc => this.getPathAndExe(proc)));
            if (processes.length === 0) {
                throw new Error("Could not find a Discord executable.");
            }
            
            if (processes.length === 1) {
                console.log(chalk.green(`Found ${processes[0].exe} under ${processes[0].path}`));
                
                return new DiscordProcess(processes[0]);
            }
            
            for (let index in processes) {
                if (!processes.hasOwnProperty(index)) {
                    continue;
                }
                
                console.log(`${index + 1}: Found ${processes[index].exe}`)
            }
            
            while (true) {
                let index = parseInt(readline.question(chalk.cyan("Discord executable to use (number): ")), 10);
                if (isNaN(index) || index >= processes.length || index < 0) {
                    console.warn(chalk.yellow("Invalid index passed"));
                    continue;
                }
                
                console.log(chalk.green(`Using ${processes[index].exe} under ${processes[index].path}`));
                
                return new DiscordProcess(processes[index]);
            }
        } catch (e) {
            throw e;
        }
    }
    
    getProcesses() {
        return new Promise((resolve, reject) => {
            ps.get((err, processes) => {
                if (err) {
                    return reject(err);
                }
                
                resolve(processes.filter(proc => /^Discord(?!.*Helper$).*$/.test(proc.name)));
            });
        });
    }
    
    async getPathAndExe(proc) {
        return new Promise((resolve, reject) => {
            if (process.platform !== 'win32') {
                try {
                    let output = execSync(`ps -o comm ${proc.pid} | tail -n 1`);
                    if (process.platform === 'darwin') {
                        const regex = new RegExp("(.*?)(" + proc.name + "\\.app)\/?(.+)?");
                        const match = regex.exec(output);
                        if (match) {
                            proc.path = match[1];
                            proc.exe  = match[2];
                            
                            return resolve(proc);
                        }
                        
                        return reject("Proc not found");
                    }
                } catch (error) {
                    reject(error);
                }
            }
        });
    }
}

module.exports = Main;