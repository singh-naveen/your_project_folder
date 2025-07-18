#!/usr/bin/env bash

# Nginx ko background mein start karein
# -g "daemon off;" Nginx ko foreground mein chalata hai, jo Docker containers ke liye recommended hai
# kyunki Docker containers tab tak run karte hain jab tak unki main process foreground mein chal rahi ho.
nginx -g "daemon off;" &

# PHP-FPM ko foreground mein start karein
# PHP-FPM bhi foreground mein chalega.
# '&' lagane se dono commands background mein chalenge, aur script exit nahi hogi jab tak dono processes alive hain.
php-fpm
