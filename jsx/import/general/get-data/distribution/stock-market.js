/**
 * stock-market.jsx: conditionally get csv data or load test data.
 *
 * Note: this script implements jsx (reactjs) syntax.
 *
 * Note: importing 'named export' (multiple export statements in a module),
 *       requires the object being imported, to be surrounded by { brackets }.
 *
 */

import { readString } from 'react-papaparse';
import { STOCK_MARKET, STOCK_SPLIT } from '../../stream-id.js';
import { noteResponse } from '../../rate-limit.js';

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (err) {
        return false;
    }
}

function get_promise(url, callback, source, stream) {
    if (isValidUrl(url)) {
        return fetch(url, {method: 'GET'})
            .then((response) => {
                noteResponse(response);

                if (response.ok) {
                    return response.json();
                }
                return Promise.reject(response);
            })
            .then((json) => {
                if ('report' in json) {
                    if (
                        'data-distribution' in json.report
                        && 'partition' in json.report
                    ) {
                        const promise_distribution = readString(json.report['data-distribution'], {
                            download: false,
                            header: true,
                            skipEmptyLines: 'greedy',
                            complete: (results) => {
                                if ('data' in results && results.data) {
                                    callback({
                                        'data-distribution': results.data,
                                        source: source,
                                        stream: stream
                                    });
                                } else {
                                    callback({ 'data-distribution': null, source: source, stream: stream });
                                }
                            }
                        });

                        const promise_count = readString(json.report.partition, {
                            download: false,
                            header: true,
                            skipEmptyLines: 'greedy',
                            complete: (results) => {
                                if ('data' in results && results.data) {
                                    callback({ partition: results.data, source: source, stream: stream });
                                } else {
                                    callback({ partition: null, source: source, stream: stream });
                                }
                            }
                        });

                        return Promise.all([promise_distribution, promise_count]).then((v) => {
                            return {'data-distribution': v[0], 'partition': v[1]};
                        });
                    }
                }
                return Promise.reject(json);
            })
            .catch((e) => {
                if (typeof e === 'object') {
                    console.log(`Error: url=${url} returned ${JSON.stringify(e)}`);
                } else {
                    console.log(`Error: url=${url} returned ${e}`);
                }
            });
    } else {
        const promise_distribution = readString(url['data-distribution'], {
            download: false,
            header: true,
            skipEmptyLines: 'greedy',
            complete: (results) => {
                if ('data' in results && results.data) {
                    callback({
                        'data-distribution': results.data,
                        source: source,
                        stream: stream
                    });
                } else {
                    callback({ 'data-distribution': null, source: source, stream: stream });
                }
            }
        });

        const promise_count = readString(url['count'], {
            download: false,
            header: true,
            skipEmptyLines: 'greedy',
            complete: (results) => {
                if ('data' in results && results.data) {
                    callback({ partition: results.data, source: source, stream: stream });
                } else {
                    callback({ partition: null, source: source, stream: stream });
                }
            }
        });

        return Promise.all([promise_distribution, promise_count]).then((v) => {
            return {'data-distribution': v[0], 'partition': v[1]};
        });
    }
}

function get(type, url, callback, worker, source, stream) {

    if (type === 'data-distribution') {
        if (url) {
            return get_promise(url, callback, source, stream);
        } else {
            if (stream === STOCK_MARKET) {
                var csv_data_distribution = `sector,industry,total_tickers,total_records
                    Communication Services,Advertising,2,128848
                    Communication Services,Broadcasting,3,122782
                    Communication Services,Cable & Satellite,2,240702
                    Communication Services,Integrated Telecommunication Services,2,142240
                    Communication Services,Interactive Home Entertainment,2,258552
                    Communication Services,Interactive Media & Services,3,1409796
                    Communication Services,Movies & Entertainment,5,646000
                    Communication Services,Publishing,2,12288
                    Communication Services,Wireless Telecommunication Services,2,253500
                    Consumer Discretionary,Apparel Retail,2,206444
                    Consumer Discretionary,"Apparel, Accessories & Luxury Goods",4,409136
                    Consumer Discretionary,Automobile Manufacturers,3,733954
                    Consumer Discretionary,Automotive Parts & Equipment,1,26352
                    Consumer Discretionary,Automotive Retail,3,368640
                    Consumer Discretionary,Broadline Retail,2,338150
                    Consumer Discretionary,Casinos & Gaming,3,268470
                    Consumer Discretionary,Computer & Electronics Retail,1,90150
                    Consumer Discretionary,Consumer Electronics,1,31160
                    Consumer Discretionary,Distributors,1,41426
                    Consumer Discretionary,Footwear,1,104590
                    Consumer Discretionary,Home Improvement Retail,2,293128
                    Consumer Discretionary,Homebuilding,4,309712
                    Consumer Discretionary,Homefurnishing Retail,1,69032
                    Consumer Discretionary,"Hotels, Resorts & Cruise Lines",8,1214522
                    Consumer Discretionary,Leisure Products,1,53854
                    Consumer Discretionary,Other Specialty Retail,2,273418
                    Consumer Discretionary,Restaurants,6,512766
                    Consumer Discretionary,Specialized Consumer Services,1,128312
                    Consumer Staples,Agricultural Products & Services,2,76640
                    Consumer Staples,Brewers,1,18680
                    Consumer Staples,Consumer Staples Merchandise Retail,5,813414
                    Consumer Staples,Distillers & Vintners,1,113540
                    Consumer Staples,Food Distributors,1,49110
                    Consumer Staples,Food Retail,2,122630
                    Consumer Staples,Household Products,4,229262
                    Consumer Staples,Packaged Foods & Meats,8,395628
                    Consumer Staples,Personal Care Products,3,254322
                    Consumer Staples,Soft Drinks & Non-alcoholic Beverages,4,271178
                    Consumer Staples,Tobacco,2,172766
                    Energy,Integrated Oil & Gas,2,236384
                    Energy,Oil & Gas Equipment & Services,3,184484
                    Energy,Oil & Gas Exploration & Production,9,683760
                    Energy,Oil & Gas Refining & Marketing,3,318246
                    Energy,Oil & Gas Storage & Transportation,4,218322
                    Financials,Asset Management & Custody Banks,12,1008180
                    Financials,Consumer Finance,3,320486
                    Financials,Diversified Banks,7,780790
                    Financials,Financial Exchanges & Data,9,945726
                    Financials,Insurance Brokers,6,161036
                    Financials,Investment Banking & Brokerage,6,1206306
                    Financials,Life & Health Insurance,5,234110
                    Financials,Multi-line Insurance,3,132966
                    Financials,Property & Casualty Insurance,8,381174
                    Financials,Regional Banks,6,232972
                    Financials,Reinsurance,1,22368
                    Financials,Transaction & Payment Processing Services,9,870866
                    Health Care,Biotechnology,8,1119026
                    Health Care,Health Care Distributors,4,325948
                    Health Care,Health Care Equipment,16,1059458
                    Health Care,Health Care Facilities,2,137586
                    Health Care,Health Care Services,5,326012
                    Health Care,Health Care Supplies,3,175204
                    Health Care,Health Care Technology,2,75776
                    Health Care,Life Sciences Tools & Services,8,531576
                    Health Care,Managed Health Care,4,579016
                    Health Care,Pharmaceuticals,7,841224
                    Industrials,Aerospace & Defense,13,1527836
                    Industrials,Agricultural & Farm Machinery,1,196520
                    Industrials,Air Freight & Logistics,4,270370
                    Industrials,Building Products,8,322172
                    Industrials,Cargo Ground Transportation,3,115628
                    Industrials,Construction & Engineering,4,351042
                    Industrials,Construction Machinery & Heavy Transportation Equipment,4,550132
                    Industrials,Data Processing & Outsourced Services,1,21824
                    Industrials,Diversified Support Services,3,176996
                    Industrials,Electrical Components & Equipment,5,544596
                    Industrials,Environmental & Facilities Services,4,106708
                    Industrials,Heavy Electrical Equipment,2,561718
                    Industrials,Human Resource & Employment Services,2,159498
                    Industrials,Industrial Conglomerates,2,166265
                    Industrials,Industrial Machinery & Supplies & Components,14,576398
                    Industrials,Passenger Airlines,3,317693
                    Industrials,Passenger Ground Transportation,1,110250
                    Industrials,Rail Transportation,3,280068
                    Industrials,Research & Consulting Services,2,52880
                    Industrials,Trading Companies & Distributors,2,267848
                    Information Technology,Application Software,15,2437128
                    Information Technology,Communications Equipment,6,1154004
                    Information Technology,Electronic Components,3,476850
                    Information Technology,Electronic Equipment & Instruments,4,191450
                    Information Technology,Electronic Manufacturing Services,3,282980
                    Information Technology,IT Consulting & Other Services,4,449996
                    Information Technology,Internet Services & Infrastructure,3,276674
                    Information Technology,Semiconductor Materials & Equipment,5,1066840
                    Information Technology,Semiconductors,14,3125430
                    Information Technology,Systems Software,6,1359852
                    Information Technology,Technology Distributors,1,28404
                    Information Technology,"Technology Hardware, Storage & Peripherals",8,1977616
                    Materials,Commodity Chemicals,1,66266
                    Materials,Construction Materials,3,160740
                    Materials,Copper,1,83144
                    Materials,Fertilizers & Agricultural Chemicals,3,197520
                    Materials,Gold,1,119442
                    Materials,Industrial Gases,2,166588
                    Materials,"Metal, Glass & Plastic Containers",1,43622
                    Materials,Paper & Plastic Packaging Products & Materials,5,137734
                    Materials,Specialty Chemicals,7,493652
                    Materials,Steel,2,175662
                    Real Estate,Data Center REITs,2,204240
                    Real Estate,Health Care REITs,3,70324
                    Real Estate,Hotel & Resort REITs,2,38440
                    Real Estate,Industrial REITs,1,56928
                    Real Estate,Multi-Family Residential REITs,6,107204
                    Real Estate,Office REITs,2,52992
                    Real Estate,Other Specialized REITs,1,104018
                    Real Estate,Real Estate Services,2,66276
                    Real Estate,Retail REITs,5,122688
                    Real Estate,Self-Storage REITs,2,40320
                    Real Estate,Single-Family Residential REITs,1,11056
                    Real Estate,Telecom Tower REITs,3,134214
                    Real Estate,Timber REITs,1,17642
                    Utilities,Electric Utilities,15,700430
                    Utilities,Gas Utilities,1,18144
                    Utilities,Independent Power Producers & Energy Traders,2,168940
                    Utilities,Multi-Utilities,12,371125
                    Utilities,Water Utilities,1,17760
                    other,other,24,605694
                ,,,`;

                var csv_count = `count\n20,,,`;

            } else if (stream === STOCK_SPLIT) {
                {/*

                    the datalake api's stock-split answer for September 2026, as
                    production draws it: a row per day, sector and industry, a
                    split with no company on file 'other' in both (#192)

                */}
                var csv_data_distribution = `split_date,sector,industry,total_tickers,tickers,total_records
                    1,Office of Manufacturing,"MISCELLANEOUS ELECTRICAL MACHINERY, EQUIPMENT & SUPPLIES",1,buru 1:40,1
                    2,Office of Manufacturing,ELECTRONIC CONNECTORS,1,aph 2:1,1
                    3,Industrial Applications and Services,INDUSTRIAL ORGANIC CHEMICALS,1,tanh 1:50,1
                    3,Industrial Applications and Services,"ORTHOPEDIC, PROSTHETIC & SURGICAL APPLIANCES & SUPPLIES",1,clgn 1:10,1
                    4,Industrial Applications and Services,"SERVICES-MISC HEALTH & ALLIED SERVICES, NEC",1,brtx 1:20,1
                    4,Industrial Applications and Services,SURGICAL & MEDICAL INSTRUMENTS & APPARATUS,1,ctso 1:20,1
                    4,Office of Energy & Transportation,TRUCKING & COURIER SERVICES (NO AIR),1,sfwl 1:15,1
                    4,Office of Life Sciences,PHARMACEUTICAL PREPARATIONS,1,gtbp 1:25,1
                    4,Office of Real Estate & Construction,REAL ESTATE AGENTS & MANAGERS (FOR OTHERS),1,lrhc 1:6,1
                    4,Office of Technology,SERVICES-PREPACKAGED SOFTWARE,2,"aixi 1:7, wct 1:5",2
                    4,Office of Trade & Services,SERVICES-ADVERTISING,1,tnmg 1:8,1
                    4,other,other,3,"cptlf 1:10, igr 1:3, txxd 1:10",3
                    8,Office of Finance,FINANCE SERVICES,1,alp 1:50,1
                    8,Office of Life Sciences,PHARMACEUTICAL PREPARATIONS,1,krsa 1:7,1
                    8,Office of Manufacturing,"MISCELLANEOUS ELECTRICAL MACHINERY, EQUIPMENT & SUPPLIES",2,"ucar 1:10, ucar 1:20",2
                    8,Office of Technology,SERVICES-COMPUTER PROGRAMMING SERVICES,1,jfil 1:100,1
                    8,other,other,10,"aurwf 1:10, avxx 1:5, cycn 1:7, ionz 1:10, jmpld 3:4, jmply 3:4, oscx 3:1, phge 1:10, rcax 1:5, rklz 1:5",10
                    9,Office of Finance,"SECURITY BROKERS, DEALERS & FLOTATION COMPANIES",2,"lghl 1:20, lghl 1:9",2
                    9,Office of Real Estate & Construction,REAL ESTATE INVESTMENT TRUSTS,1,lft 1:10,1
                    9,other,other,9,"astn 1:4, damd 1:10, keex 4:1, lnok 2:1, okll 1:5, qbtz 1:5, rgtz 1:5, smcz 1:2, stsm 1:2",9
                    10,Office of Energy & Transportation,BITUMINOUS COAL & LIGNITE MINING,1,metcb 1.025626:1,1
                    10,Office of Life Sciences,PHARMACEUTICAL PREPARATIONS,1,goss 1:80,1
                    10,Office of Manufacturing,"MISCELLANEOUS ELECTRICAL MACHINERY, EQUIPMENT & SUPPLIES",1,gauz 1:20,1
                    10,other,other,2,"bjurf 1:30, gbgd 1:1000",2
                    11,Office of Energy & Transportation,ELECTRIC SERVICES,1,optt 1:30,1
                    11,Office of Energy & Transportation,METAL MINING,1,lcgmf 1:27,1
                    11,Office of Energy & Transportation,NATURAL GAS DISTRIBUTION,1,nfe 1:50,1
                    11,Office of Life Sciences,PHARMACEUTICAL PREPARATIONS,1,nrsn 1:20,1
                    11,Office of Technology,COMPUTER COMMUNICATIONS EQUIPMENT,2,"hubc 1:20, hubc 1:25",2
                    11,Office of Technology,"SERVICES-COMPUTER PROGRAMMING, DATA PROCESSING, ETC.",1,ipdn 1:30,1
                    11,Office of Trade & Services,RETAIL-AUTO DEALERS & GASOLINE STATIONS,1,nxxt 1:10,1
                    11,Office of Trade & Services,SERVICES-AMUSEMENT & RECREATION SERVICES,2,"cpop 1:10, cpop 1:15",2
                    11,other,other,1,nktp 1:25,1
                    14,Office of Trade & Services,"RETAIL-RADIO, TV & CONSUMER ELECTRONICS STORES",1,izm 1:5,1
                    15,Office of Trade & Services,SERVICES-MISCELLANEOUS AMUSEMENT & RECREATION,1,fbydp 1.02:1,1
                    15,Office of Trade & Services,SERVICES-MOTION PICTURE & VIDEO TAPE PRODUCTION,1,mpu 1:20,1
                    16,Industrial Applications and Services,AGRICULTURAL PROD-LIVESTOCK & ANIMAL SPECIALTIES,1,mgn 1:30,1
                    16,Office of Energy & Transportation,DEEP SEA FOREIGN TRANSPORTATION OF FREIGHT,1,nct 1:25,1
                    16,Office of Life Sciences,PHARMACEUTICAL PREPARATIONS,1,jagx 1:15,1
                    17,Office of Manufacturing,"MISCELLANEOUS ELECTRICAL MACHINERY, EQUIPMENT & SUPPLIES",1,epow 1:25,1
                    17,other,other,2,"lecrf 1:10, pnxpf 1:5",2
                    18,Office of Trade & Services,RETAIL-CATALOG & MAIL-ORDER HOUSES,1,uzx 1:23,1
                    18,other,other,1,fexxf 1:8,1
                    21,Office of Real Estate & Construction,REAL ESTATE INVESTMENT TRUSTS,2,"whlr 1:3, whlr 1:9",2
                    21,Office of Technology,SERVICES-PREPACKAGED SOFTWARE,1,vwav 1:20,1
                    21,other,other,9,"axtx 1:4, crmx 1:4, litz 1:4, nbiz 1:4, ondu 1:4, qbtx 1:4, qubx 1:4, smu 1:4, unx 4:1",9
                    22,Office of Manufacturing,PAPERBOARD CONTAINERS & BOXES,2,"ibo 1:12, ibo 1:12.62",2
                    24,Office of Technology,"GENERAL INDUSTRIAL MACHINERY & EQUIPMENT, NEC",1,kitt 1:6,1
                    24,Office of Technology,SERVICES-PREPACKAGED SOFTWARE,1,rpgl 1:16,1
                    24,other,other,1,frsaf 1:20,1
                    25,Office of Life Sciences,PHARMACEUTICAL PREPARATIONS,2,"immp 1:20, mtnb 1:15",2
                    25,Office of Manufacturing,MOTOR VEHICLES & PASSENGER CAR BODIES,1,dcx 1:160,1
                    25,Office of Manufacturing,"SPORTING & ATHLETIC GOODS, NEC",2,"gmex 1:7, gmex 1:9",2
                    25,Office of Real Estate & Construction,GENERAL BLDG CONTRACTORS - RESIDENTIAL BLDGS,1,fbgl 1:10,1
                    25,Office of Technology,SERVICES-COMPUTER PROGRAMMING SERVICES,1,btln 1:8,1
                    25,Office of Trade & Services,WHOLESALE-MOTOR VEHICLES & MOTOR VEHICLE PARTS & SUPPLIES,1,ctnt 1:150,1
                    25,Office of Trade & Services,WHOLESALE-PETROLEUM & PETROLEUM PRODUCTS (NO BULK STATIONS),1,dlxy 1:5,1
                    25,other,other,1,abepf 1:15,1
                    28,Industrial Applications and Services,AGRICULTURAL PRODUCTION-CROPS,1,agrz 1:20,1
                    28,Industrial Applications and Services,SERVICES-COMMERCIAL PHYSICAL & BIOLOGICAL RESEARCH,1,onmd 1:10,1
                    28,Office of Finance,FINANCE SERVICES,1,vrme 1:10,1
                    28,Office of Life Sciences,PHARMACEUTICAL PREPARATIONS,1,cdt 1:25,1
                    28,Office of Manufacturing,"SPORTING & ATHLETIC GOODS, NEC",1,trug 1:10,1
                    29,Office of Crypto Assets,COMMODITY CONTRACTS BROKERS & DEALERS,1,zcsh 3:1,1
                    29,Office of Finance,FINANCE SERVICES,1,shfs 1:12,1
                    29,Office of Real Estate & Construction,CONSTRUCTION - SPECIAL TRADE CONTRACTORS,1,cetxp 105:100,1
                    29,other,other,2,"dhy 1:10, ibidy 2:1",2
                    30,Office of Life Sciences,PHARMACEUTICAL PREPARATIONS,1,bgm 1:30,1
                    30,Office of Manufacturing,RADIO & TV BROADCASTING & COMMUNICATIONS EQUIPMENT,1,kust 1:10,1
                    30,Office of Technology,SERVICES-PREPACKAGED SOFTWARE,1,myps 1:10,1
                    30,other,other,1,vbamf 1:10,1
                ,,,`;

                var csv_count = `count\n0,,,`;
            } else {
                console.log(`Error (data-distribution): stream=${stream} NOT valid`);
            }

            return get_promise({
                'data-distribution': csv_data_distribution,
                'count': csv_count
            }, callback, source, stream);
        }
    } else {
        console.log(`Error: ${type} not a valid choice.`)
    }
}

export default function getDataDistribution(type, url=null, callback=()=>{}, worker=false, source=null, stream=null) {
    return get(type, url, callback, worker, source, stream);
}
