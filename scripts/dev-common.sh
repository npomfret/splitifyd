#!/bin/bash

# Common development environment setup function
start_dev_instance() {
    local instance=$1
    local color_code=$2
    local color_name=$3
    
    # Set terminal title and background color for Mac Terminal using AppleScript
    printf "\033]0;DEV Instance ${instance} - ${color_name}\007"
    
    # Set background color using osascript (AppleScript) based on instance
    case $instance in
        1) osascript -e "tell application \"Terminal\" to set background color of selected tab of window 1 to {0, 32768, 0}" ;; # Green
        2) osascript -e "tell application \"Terminal\" to set background color of selected tab of window 1 to {0, 0, 32768}" ;; # Blue  
        3) osascript -e "tell application \"Terminal\" to set background color of selected tab of window 1 to {32768, 32768, 0}" ;; # Yellow
    esac
    
    printf "\033[1;${color_code}m"
    
    echo "=================================================="
    echo "     🚀 STARTING DEVELOPMENT INSTANCE ${instance}"
    echo "        ${color_name} Environment"
    echo "=================================================="
    printf "\033[0m"
    
    # Set a colored prompt with background that persists
    case $instance in
        1) export PS1="\[\033[42m\033[1;30m\][DEV-${instance}]\[\033[0m\] \$ " ;; # Green bg, black text
        2) export PS1="\[\033[44m\033[1;37m\][DEV-${instance}]\[\033[0m\] \$ " ;; # Blue bg, white text  
        3) export PS1="\[\033[43m\033[1;30m\][DEV-${instance}]\[\033[0m\] \$ " ;; # Yellow bg, black text
    esac
    
    clear && (cd firebase && npm run switch-instance ${instance}) && npm run dev
}