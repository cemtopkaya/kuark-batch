function SaglikBank() {
    var http = require('http'),
//$ = require('jquery'),
        $ = require('cheerio'),
        Q = require('q'),
        _ = require('underscore'),
        moment = require('moment'),
        Buffer = require('buffer').Buffer,
        iconv = require('iconv-lite'),
        assert = require('assert'),
        result = {};

    var formData = {
            // Pass a simple key-value pair
            '__EVENTTARGET': '',
            '__EVENTARGUMENT': '',
            '__VIEWSTATE': '%2FwEPDwUINTY1NjQ1NjMPZBYCZg9kFgICAw9kFgICAw9kFgRmD2QWAgIBD2QWAmYPDxYCHgRUZXh0ZWRkAgIPZBYCZg9kFgJmDw8WAh8AZWRkGAEFHl9fQ29udHJvbHNSZXF1aXJlUG9zdEJhY2tLZXlfXxYCBSBjdGwwMCRBbmFzYXlmYU1lbnUkQmVuaUhhdGlybGFDQgUbY3RsMDAkQW5hc2F5ZmFNZW51JExvZ2luQlRO57zrGdJrNAMFnmFleQgptHX%2BERSLgz3T%2BjfObKVWzK0%3D',
            '__VIEWSTATEGENERATOR': '8D0E13E6',
            'ctl00$AnasayfaMenu$KullaniciAdiTB': 'ecetibbi',
            'ctl00$AnasayfaMenu$SifreTB': 'ece2015',
            'ctl00$AnasayfaMenu$LoginBTN.x': 24,
            'ctl00$AnasayfaMenu$LoginBTN.y': 7
        },
        options = {
            //path: '/Home.aspx?Saglikbank-Tibbi-ihale-yayinlari-Anasayfa&Page=I4BRF72BR7A1Y9D5Y7VKB7B0W84VB5U0',
            method: 'GET',
            //host: '127.0.0.1',
            //port: 8888,
            hostname: 'saglikbank.com',
            path: "http://saglikbank.com/UyeYonetim/Home.aspx",
            headers: {
                Connection: 'keep-alive',
                Host: 'saglikbank.com',
                'Cache-Control': 'max-age=0',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.65 Safari/537.36',
                'Accept-Language': 'tr-TR,tr;q=0.8,en-US;q=0.6,en;q=0.4,fr;q=0.2,ru;q=0.2'
                //,'Cookie': cookieStr
            }
        };
    var cookieStr, $this = this;

    var f_encodeTurkish = function (_chunk) {
        return iconv.decode(new Buffer(_chunk, 'binary'), 'ISO-8859-9');
    };

    var f_rss = function (_firstX, _url) {
        console.log("---------- F_TEST_RSS -------------");
        options.method = 'GET';
        options.path = _url || 'http://saglikbank.com/UyeYonetim/RssKisisel.aspx?Kriter=S3U9X4C0W453N3TLV48O';
        delete options.headers["Content-Type"];
        delete options.headers["Content-Length"];


        var arrIhale,
            deferred = Q.defer();

        console.log(options);
        http.request(options, function (_res) {
            var html = '';
            _res
                .on('data', function (_chunk) {
                    html += _chunk;
                })
                .on('error', function (_chunk) {
                    console.log("Test RSS okunurken, Response Error: " + JSON.stringify(arguments));
                })
                .on('end', function () {
                    var defaults = require('json-schema-defaults'),
                        schema = require('../../schema');
                    // forEach, map, some
                    arrIhale = $(html).find('item description').map(function (idx, _elm) {
                        var link = $($(_elm).text()).find("a").attr('href');
                        return {
                            id: link.substring(69, (link.lastIndexOf('&'))),
                            adres: link
                        };
                    }).toArray();
                    console.log("rss arrIhale: " + arrIhale);
                    deferred.resolve(_.first(arrIhale, _firstX || 2));
                });
        }).on('error', function () {
            console.log("Request Error:");
            console.log(arguments);
        }).end();

        return deferred.promise;
    };

    var f_getLastCookie = function () {
        console.log("---------- GET LAST COOKIE -------------");
        var defer = Q.defer();

        result.db.dbQ.zrevrange("COOKIES", "0", "0")
            .then(function (r) {
                console.log(r);
                console.log(r.pop());
                if (r.pop()) {
                    cookieStr = JSON.parse(r.pop());
                }
                console.log("\tLast cookie is: ");
                console.log(cookieStr);
                defer.resolve(cookieStr);
            })
            .fail(function () {
                console.log("ERROR: " + e);
                defer.reject(e);
            });

        /*  result.db.dbQ.zrevrange("COOKIES", "0", "0",
         function (e, r) {
         if (e) {
         console.log("ERROR: " + e);
         defer.reject(e);
         } else {
         console.log("r:"+r);
         cookieStr = JSON.parse(r.pop());
         console.log("\tLast cookie is: ");
         console.log(cookieStr);
         defer.resolve(cookieStr);
         }
         });*/
        return defer.promise;
    };

    var f_isSessionUp = function (_cookieString) {
        console.log("---------- IS SESSION UP -------------");
        var defer = Q.defer();
        console.log("******" + _cookieString);
        if (!_cookieString) {
            // cookie is undefined
            console.log("COOKIE String undefined geldi");
            defer.resolve(false);
        } else {
            console.log("Session ayaktamı kontrol ediliyor:");
            options.method = 'GET';
            options.path = "http://saglikbank.com/UyeYonetim/Home.aspx";
            options.headers.Cookie = _cookieString;

            var req = http.request(options, function (res) {
                res.on('data', function () {
                }).on('end', function () {
                });
                console.log("is session response status code > " + res.statusCode);
                console.log("is session response headers > " + JSON.stringify(res.headers));
                if (res.statusCode == 200) {
                    console.log("Session UP");
                    defer.resolve(true);
                } else {
                    console.log("Session DOWN");
                    defer.resolve(false);
                }
            }).on('error', function () {
                console.log("Session UP Request error");
                console.log("args: " + JSON.stringify(arguments));
            });

            req.end();
        }
        return defer.promise;
    };

    var f_getNewSessionId = function () {
        console.log("---------- f_getNewSessionId -------------");
        var defer = Q.defer();
        options.method = 'POST';
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.path = 'http://saglikbank.com/Home.aspx?Saglikbank-Tibbi-ihale-yayinlari-Anasayfa&Page=C3ZZT8G0I6GJD75ZS7CZH800J6VOE64S';
        options.headers.Referer = "http://www.saglikbank.com/Home.aspx?Saglikbank-Tibbi-ihale-yayinlari-Anasayfa&Page=I4BRQ860C5YYU8Z7A5R2S97BL73VP745";
        options.headers["Accept-Language"] = "tr-TR,tr;q=0.8,en-US;q=0.6,en;q=0.4";
        options.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.94 Safari/537.36";
        //options.headersOrigin = "http://www.saglikbank.com";
        options.headers.Origin = "http://www.saglikbank.com";
        delete options.headers["Content-Length"];

        var req = http.request(options, function (res) {
            var body = '';
            res.on('data', function (chunk) {
                body += (chunk);
            }).on('error', function (e) {
                var error = "Yeni cookie alırken, Response Error: " + e.message;
                console.log(error);
                defer.reject(error);
            }).on('end', function (e) {
                console.log("-------- f_getNewSessionId RESPONSE -------------");
                console.log('STATUS: ' + res.statusCode);
                console.log("LOCATION:" + res.headers.location);
                console.log('HEADERS: ' + JSON.stringify(res.headers));

                console.log("SET COOKIE: " + res.headers["set-cookie"]);

                if(res.headers["set-cookie"]==undefined){
                    console.log("COOKİE BULUNAMADI");
                    defer.reject("COOKİE BULUNAMADI");
                }else{
                    cookieStr = res.headers["set-cookie"][0].substring(0, res.headers["set-cookie"][0].indexOf(";"));
                    cookieStr += "; " + res.headers["set-cookie"][1].substring(0, res.headers["set-cookie"][1].indexOf(";"));
                    options.headers.Cookie = cookieStr;

                    defer.resolve(cookieStr);
                }
            });
        }).end();
        return defer.promise;
    };

    var f_logon = function (_isSessionUp) {
        console.log("---------- F_LOGON -------------");
        var defer = Q.defer();

        if (_isSessionUp) {
            defer.resolve(cookieStr);
        } else {
            console.log("ASP Session ID Alacak.");
            f_getNewSessionId()
                .then(function (_cookieString) {
                    console.log(_cookieString);
                    options.headers.Cookie = _cookieString;

                    var data = '__EVENTTARGET=&__EVENTARGUMENT=&__VIEWSTATE=%2FwEPDwUINTY1NjQ1NjMPZBYCZg9kFgICAw9kFgICAw9kFgRmD2QWAgIBD2QWAmYPDxYCHgRUZXh0ZWRkAgIPZBYCZg9kFgJmDw8WAh8AZWRkGAEFHl9fQ29udHJvbHNSZXF1aXJlUG9zdEJhY2tLZXlfXxYCBSBjdGwwMCRBbmFzYXlmYU1lbnUkQmVuaUhhdGlybGFDQgUbY3RsMDAkQW5hc2F5ZmFNZW51JExvZ2luQlROrFN1frFsdKW7ExOpDNhdFjGZWkdufSrEu6bkbNe60NA%3D&__VIEWSTATEGENERATOR=8D0E13E6&ctl00%24AnasayfaMenu%24KullaniciAdiTB=ecetibbi&ctl00%24AnasayfaMenu%24SifreTB=ece2015&ctl00%24AnasayfaMenu%24LoginBTN.x=0&ctl00%24AnasayfaMenu%24LoginBTN.y=0';

                    delete options.headers["Content-Length"];

                    console.log("********** Tekrar LOGON olacak **************");
                    console.log("Gönderilen options: ");
                    console.log(options);

                    var req = http.request(options, function (res) {
                        var body = '';
                        res.on('data', function (chunk) {
                            body += f_encodeTurkish(chunk);
                        }).on('error', function (e) {
                            var error = "Tekrar LOGON'da, Response Error: " + e.message;
                            console.log(error);
                            defer.reject(error);
                        }).on('end', function (e) {
                            console.log(body);
                        });

                        console.log("-------- F_LOGON RESPONSE -------------");
                        console.log('STATUS: ' + res.statusCode);
                        console.log('HEADERS: ' + JSON.stringify(res.headers));
                        console.log("LOCATION:" + res.headers.location);

                        //if (res.statusCode == 302 && res.headers.location == '/UyeYonetim/Home.aspx') {
                        if (res.statusCode == 302) {
                            options.method = 'GET';
                            options.headers.Referer = options.path;
                            options.path = 'http://saglikbank.com/UyeYonetim/Home.aspx';

                            delete options.headers["Content-Length"];

                            http.request(options, function (_res) {
                                var sayfa = '';
                                _res.setEncoding('utf8');
                                _res.on('data', function (chunk) {
                                    sayfa += chunk;
                                }).on('end', function () {
                                    var lenTBKullanici = $(sayfa).find('#KullaniciAdiTB').length;
                                    if (lenTBKullanici == 0) {
                                        console.log("Logon successful and cookie is: ");
                                        console.log(options.headers.Cookie);
                                        f_postCookie(cookieStr);
                                        defer.resolve(cookieStr);
                                    } else {
                                        defer.reject('olmadı...')
                                    }
                                })
                            }).end();

                        } else {
                            defer.reject("Logon hasn't been completed")
                        }

                    }).on('error', function (e) {
                        console.log('problem with request: ' + e.message);
                        defer.reject("Request sırasında hata alındı... " + e.message);
                    });

                    // write data and end request
                    req.write(data);
                    req.end();
                });

        }
        return defer.promise;
    };

    var f_postCookie = function (_cookie) {
        console.log("---------- F_POST_COOKIE -------------");
        console.log(_cookie);
        var defer = Q.defer();
        result.db.dbQ.zadd("COOKIES", (new Date()).getTime(), JSON.stringify(_cookie))
            .then(function (r) {
                defer.resolve(_cookie);
            })
            .fail(function () {
                defer.reject("Post cookie işleminde hata alındı");
            });
        return defer.promise;
    };

    /*
     * Logon başarılı olduğunda önce asp session id oluşacak ve cookie ye yazarak geri dönecek.
     * Buradan cookie okunur ve sonraki veri okumalarında kullanılır.
     */
    var f_getIhale = function (_ihale) {
        console.log("---------- F_GET_IHALE -------------");
        var defer = Q.defer(),
            sayfa = '';

        options.method = 'GET';
        options.path = _ihale.yonlendirilenAdres || _ihale.adres.replace('www.', '');
        delete options.headers['Content-Length'];
        delete options.headers['Content-Type'];

        http.request(options, function (res) {
            console.log('STATUS: ' + res.statusCode);
            console.log('HEADERS: ' + JSON.stringify(res.headers));

            res.
                on('error', function () {
                    var error = "f_getIhale sırasında, Response Error: " + JSON.stringify(arguments);
                    console.log(error);
                    defer.reject(error);
                })
                .on('data', function (chunk) {
                    sayfa += f_encodeTurkish(chunk);
                });

            if (res.statusCode == 302) {
                console.log("-------------- LOCATION -----------\n" + res.headers.location);
                _ihale.yonlendirilenAdres = 'http://saglikbank.com/' + res.headers.location;
                options.headers.Referer = options.path;
                console.log(_ihale.yonlendirilenAdres);
                res.on('end', function () {
                    sayfa = '';
                    f_getIhale(_ihale)
                        .then(function (_ihale) {
                            console.log("ikinci kez getIhale");
                            defer.resolve(_ihale);
                        })
                        .fail(function () {
                            var error = "f_getIhale sırasında Error: " + JSON.stringify(arguments);
                            console.log(error);
                            defer.reject(error);
                        });
                });
            } else {
                res.on('end', function () {
                    $sayfa = $(sayfa);

                    var ihaleUsul = $sayfa.find("#UsulLBL").text().trim();
                    var ihaleNo = $sayfa.find("#KayitNoLBL").text().trim();
                    var ihaleKonusu = $sayfa.find("#IhaleKonusuLBL").text().trim();

                    var kurumAdi = $sayfa.find("#ctl00_KurumAdi2LBL").text().trim();
                    var ihaleTarihi = $sayfa.find("#ctl00_IhaleTarihi2LBL").text().trim();
                    var tarih1 = moment(ihaleTarihi, "DD.MM.YYYY");

                    var kurumTelNo = $sayfa.find("#ctl00_KurumTelefonNoLBL").text().trim();
                    var sistemeEklenmeTarihi = $sayfa.find("#ctl00_EklemeTarihiLBL").text();
                    var tarih2 = moment(sistemeEklenmeTarihi, "DD.MM.YYYY hh:mm");

                    var kurumFaksNo = $sayfa.find("#ctl00_KurumFaksNoLBL").text().trim();
                    var kurumEmail = $sayfa.find("#ctl00_KurumEmailTB").find("a").text().trim();
                    var kurumAdres = $sayfa.find("#ctl00_KurumAdresiLBL").text().trim();
                    var sartnameAdres = $sayfa.find("#ctl00_SartnameListesiLBL").find("a").text().trim();
//TODO: Sadece bir şartname varsa tamam ama zeyilname ya da birden fazla dosya için kontrol edilecek

                    var yeni_ihale = {
                        "Kurum": {
                            "Adi": kurumAdi,
                            "Id": 0,
                            "Tel": kurumTelNo,
                            "Eposta": kurumEmail == "[email protected]" ? "" : kurumEmail,
                            "Faks": kurumFaksNo,
                            "AcikAdres": kurumAdres
                        },
                        "IhaleNo": ihaleNo.replace('(', '').replace(')', ''),
                        "Konusu": ihaleKonusu,
                        "IhaleTarihi": new Date(tarih1).getTime(),
                        "IhaleUsul": ihaleUsul,
                        "YapilacagiAdres": "",
                        "SartnameAdres": sartnameAdres,
                        "SistemeEklenmeTarihi": new Date(tarih2).getTime()
                    };

                    var tbl = $sayfa.find(".listeTablosu").parents("table").first().find("tr").map(function () {
                        if ($(this).attr("style")) {
                            return {
                                "SiraNo": $(this).find("td").first().find("strong").text().trim(),
                                "MalzemeCinsi": $(this).find("td:nth-child(1)").text().replace('\n', '').replace('\r', '').trim(),
                                "Miktar": $(this).find("td:nth-child(2)").text().trim(),
                                "Birim": $(this).find("td:nth-child(3)").text().trim(),
                                "Aciklama": $(this).find('td:nth-child(4)').text().replace('\n', '').replace('\r', '').trim()
                            }
                        }
                    }).toArray();
                    yeni_ihale.Kalemler = tbl;

                    _ihale = _.extend(_ihale, yeni_ihale);
                    console.log("oluşan ihale:" + JSON.stringify(_ihale));
                    defer.resolve(_ihale);
                });
            }
        })
            .on('error', function (e) {
                var error = 'Problem with request: ' + e.message;
                console.log(error);
                defer.reject(error);
            })
            .on('end', function (e) {
            })
            .end();
        return defer.promise;
    };


    result.f_getBids = function (_firstX, _url) {
        var defer = Q.defer();
        console.log("f_getbids");
        f_getLastCookie()
            .then(f_isSessionUp)
            .fail(function (_hata) {
                console.log("f_isSessionUp Failed: " + _hata);
            })
            .then(f_logon)
            .fail(function (_hata) {
                console.log("Logon Failed: " + _hata);
            })
            .then(function (_cookie) {
                return f_rss(_firstX, _url)
                    .then(function (_arrIhaleler) {
                        console.log("Then: " + JSON.stringify(arguments));
                        var arr = _arrIhaleler.map(function (elm) {
                            //return f_getIhale(_arrIhaleler[0]);
                            return f_getIhale(elm);
                        });
                        Q.all(arr)
                            .then(function (_arr) {
                                defer.resolve(_arr);
                            });
                    })
                    .fail(function () {
                        var err = "İhale bilgisi çekilirken Hata alındı: " + JSON.stringify(arguments);
                        console.log(err);
                        defer.reject(err);
                    });

            });

        return defer.promise;
    };

    return result;
}

var saglikBank = SaglikBank();
saglikBank.__proto__ = require('../../server/db')();
exports.saglikBank = saglikBank;