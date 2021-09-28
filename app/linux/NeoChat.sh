if which node > /dev/null
then
    echo "Starting NeoChat..."
    BASEDIR=$(dirname "$0")
    node $BASEDIR/lib/main.js
else
    echo "You don't have node installed! Please install it from https://nodejs.org/"
    zenity --error --text="You don't have node installed!\nPlease install it from <a href=\"https://nodejs.org/\">https://nodejs.org/</a>" --title="NeoChat - Error" --width=300
fi