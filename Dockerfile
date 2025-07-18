# Base image: PHP-FPM (FastCGI Process Manager)
# php:8.1-fpm ek official PHP image hai jo web server ke saath interaction ke liye optimized hai.
FROM php:8.1-fpm

# Update package lists and install system dependencies
# Install karein zaroori libraries jaise libmagickwand-dev (ImageMagick ke liye) aur ghostscript (PDF processing ke liye)
# --no-install-recommends se sirf essential packages install honge.
# rm -rf /var/lib/apt/lists/* se apt cache files delete honge, jisse image size kam hoga.
RUN apt-get update && apt-get install -y \
    libmagickwand-dev \
    ghostscript \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Install ImageMagick PHP extension (Imagick)
# docker-php-ext-install Imagick PHP extension ko install karta hai, jo PHP ko ImageMagick libraries se interact karne deta hai.
RUN docker-php-ext-install imagick

# Copy Nginx configuration
# nginx.conf file ko container ke andar /etc/nginx/sites-available/default path par copy karein.
# Yeh Nginx ko batayega ki PHP files ko kaise serve karna hai.
COPY nginx.conf /etc/nginx/sites-available/default

# Copy the start script
# start.sh script ko container ke andar /usr/local/bin/start.sh path par copy karein.
# Yeh script Nginx aur PHP-FPM dono ko start karegi.
COPY start.sh /usr/local/bin/start.sh

# Make the start script executable
# chmod +x command start.sh script ko executable banata hai.
RUN chmod +x /usr/local/bin/start.sh

# Copy your application code to the Nginx web root
# Aapke saare project files (index.php, api.php, assets/, temp_uploads/, etc.) ko
# container ke andar /var/www/html/ path par copy karein. Yeh Nginx ka default web root hai.
COPY . /var/www/html/

# Set appropriate permissions for the uploads directory
# temp_uploads folder ko web server process ke liye writable banayein.
# chmod -R 777 bahut permissive hai aur testing ke liye theek hai, production mein isse kam permissions ka use karein.
RUN chmod -R 777 /var/www/html/temp_uploads

# Expose port 80 for Nginx (web traffic)
# Container ke andar port 80 ko expose karein, jahan Nginx listen karega incoming HTTP requests ke liye.
EXPOSE 80

# Command to run when the container starts
# Jab container start hoga, to yeh start.sh script ko execute karega.
CMD ["/usr/local/bin/start.sh"]
