﻿using Microsoft.Azure.ServiceBus;
using Microsoft.Azure.ServiceBus.Core;
using System;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;

namespace ServiceBusClientPerf
{
    class Program
    {
        private static readonly Stopwatch _stopwatch = Stopwatch.StartNew();

        private static readonly byte[] _payload = new byte[1024];

        private static long _messages;

        static async Task Main(string[] args)
        {
            var maxInflight = (args.Length >= 1 ? int.Parse(args[0]) : 1);
            Log($"Maximum inflight messages: {maxInflight}");

            var messages = (args.Length >= 2 ? long.Parse(args[1]) : 10);

            var connectionString = Environment.GetEnvironmentVariable("SERVICE_BUS_CONNECTION_STRING");
            var entityPath = Environment.GetEnvironmentVariable("SERVICE_BUS_QUEUE_NAME");

            var writeResultsTask = WriteResults(messages);

            await RunTest(connectionString, entityPath, maxInflight, messages);

            await writeResultsTask;
        }

        private static async Task RunTest(string connectionString, string entityPath, int maxInflight, long messages)
        {
            var sender = new MessageSender(connectionString, entityPath);

            var tasks = new Task[maxInflight];
            for (var i = 0; i < maxInflight; i++)
            {
                var task = ExecuteSendsAsync(sender, messages);
                tasks[i] = task;
            }

            await Task.WhenAll(tasks);
        }

        private static async Task ExecuteSendsAsync(MessageSender sender, long messages)
        {
            while (Interlocked.Increment(ref _messages) <= messages)
            {
                await sender.SendAsync(new Message(_payload));
            }
            
            // Undo last increment, since a message was never sent on the final loop iteration
            Interlocked.Decrement(ref _messages);
        }

        private static async Task WriteResults(long messages)
        {
            var lastMessages = (long)0;
            var lastElapsed = TimeSpan.Zero;

            do
            {
                await Task.Delay(TimeSpan.FromSeconds(1));

                var sentMessages = _messages;
                var currentRequests = sentMessages - lastMessages;
                lastMessages = sentMessages;


                var elapsed = _stopwatch.Elapsed;
                var currentElapsed = elapsed - lastElapsed;
                lastElapsed = elapsed;

                WriteResult(sentMessages, elapsed, currentRequests, currentElapsed);
            }
            while (Interlocked.Read(ref _messages) < messages);
        }

        private static void WriteResult(long totalMessages, TimeSpan totalElapsed,
            long currentMessages, TimeSpan currentElapsed)
        {
            Console.WriteLine(
                $"{DateTime.UtcNow.ToString("o")}\tTot Msg\t{totalMessages}" +
                $"\tCur MPS\t{Math.Round(currentMessages / currentElapsed.TotalSeconds)}" +
                $"\tAvg MPS\t{Math.Round(totalMessages / totalElapsed.TotalSeconds)}"
            );
        }

        private static void Log(string message)
        {
            Console.WriteLine($"[{DateTime.Now.ToString("hh:mm:ss.fff")}] {message}");
        }
    }
}