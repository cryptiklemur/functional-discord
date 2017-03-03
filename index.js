require("babel-register");
require("babel-polyfill");
console.log("\n");

if (!String.prototype.format) {
    String.prototype.format = function () {
        const args = arguments;
        return this.replace(/{(\d+)}/g, function (match, number) {
            return args[number] !== undefined ? args[number] : match;
        });
    };
}

const chalk   = require("chalk");
const program = require("commander");
const pkg     = require("./package.json");
const Main    = require("./src/Main");

program
    .version(pkg.version, "-V, --version")
    .description(`
    Unpacks Discord and adds JS & CSS hot-reloading.
    
Discord has to be open for this to work. When this tool is ran,
Discord will close and then be relaunched when the tool completes.
`)
    .option(
        "--location <path>",
        "directory containing the js and css files you want to load",
        Main.GetDefaultLocation()
    )
    .option(
        "--revert",
        "Reverts any changes made to Discord (does not delete custom files)"
    );

program.parse(process.argv);

(new Main(program)).run()
    .then(() => console.log("\n\n"))
    .catch(error => console.error(chalk.bold.red(error) + "\n\n"));
