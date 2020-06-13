# Project
Copyright © 2020 Andrew Rotert. All rights reserved.
#### App Store Connect API
Node JS file to access App Store Connect API via Firebase Cloud Function. 

- [x] Published - DevelopedNotDownloaded.com/app
- [x] Completed


# How Does This Work
A template webpage is rendered using express. The app is connected to Googles firebase firestore database. The app first checks the database for the requested date, if the date is found the wepage is rendered. Otherwise the app makes a https GET request to the Apple App Store Connect API. This returns a compressed GZ file. The app uses pako to unzip the file, and data can be parsed. The data is structured so that the type field is the sixth column and the units are the seventh column. The download types always start with 1. Once the data parsing is complete the results are loaded into the database, and the wepage is rendered. All of this happens in a Google Cloud Function. 


# Motivation
I wanted to be able to display the number of downloads my iOS apps get per day.


# Tech
Built using javascript, nodeJS, and firebase.
