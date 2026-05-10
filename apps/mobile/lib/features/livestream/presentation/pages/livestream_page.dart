import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:nexora_mobile/core/api/api_client.dart';

class LivestreamPage extends StatefulWidget {
  final String? streamId;

  const LivestreamPage({super.key, this.streamId});

  @override
  State<LivestreamPage> createState() => _LivestreamPageState();
}

class _LivestreamPageState extends State<LivestreamPage> {
  final ApiClient apiClient = ApiClient.create();
  List<Livestream> _streams = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    if (widget.streamId != null) {
      _loadStream(widget.streamId!);
    } else {
      _loadStreams();
    }
  }

  Future<void> _loadStreams() async {
    try {
      final streams = await apiClient.getActiveLivestreams();
      setState(() {
        _streams = streams;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _loadStream(String streamId) async {
    try {
      final stream = await apiClient.getLivestream(streamId);
      setState(() {
        _streams = [stream];
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.streamId != null && _streams.isNotEmpty) {
      return _buildStreamView(_streams.first);
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Livestreams'),
        actions: [
          IconButton(
            icon: const Icon(Icons.videocam),
            onPressed: () => _showStartStreamDialog(),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _streams.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.videocam_off,
                        size: 64,
                        color: Colors.grey[400],
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'No active streams',
                        style: TextStyle(fontSize: 18, color: Colors.grey),
                      ),
                      const SizedBox(height: 8),
                      ElevatedButton.icon(
                        onPressed: () => _showStartStreamDialog(),
                        icon: const Icon(Icons.videocam),
                        label: const Text('Start Streaming'),
                      ),
                    ],
                  ),
                )
              : GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 16 / 9,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                  ),
                  itemCount: _streams.length,
                  itemBuilder: (context, index) {
                    return _StreamCard(stream: _streams[index]);
                  },
                ),
    );
  }

  Widget _buildStreamView(Livestream stream) {
    return Scaffold(
      appBar: AppBar(
        title: Text(stream.title),
      ),
      body: Column(
        children: [
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Container(
              color: Colors.black,
              child: const Center(
                child: Icon(Icons.play_circle_outline, size: 64, color: Colors.white),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  stream.title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  stream.description,
                  style: const TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Icon(Icons.remove_red_eye),
                    const SizedBox(width: 4),
                    Text('${stream.viewerCount} viewers'),
                    const SizedBox(width: 16),
                    const Icon(Icons.favorite_border),
                    const SizedBox(width: 4),
                    const Text('Like'),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showStartStreamDialog() {
    final titleController = TextEditingController();
    final descriptionController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Start Livestream'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: titleController,
              decoration: const InputDecoration(
                labelText: 'Title',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: descriptionController,
              decoration: const InputDecoration(
                labelText: 'Description',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Stream started')),
              );
            },
            child: const Text('Go Live'),
          ),
        ],
      ),
    );
  }
}

class _StreamCard extends StatelessWidget {
  final Livestream stream;

  const _StreamCard({required this.stream});

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (stream.thumbnailUrl != null)
            CachedNetworkImage(
              imageUrl: stream.thumbnailUrl!,
              fit: BoxFit.cover,
            )
          else
            Container(
              color: Colors.grey[300],
              child: const Center(child: Icon(Icons.videocam, size: 48)),
            ),
          if (stream.status == 'live')
            Positioned(
              top: 8,
              left: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.red,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'LIVE',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
          Positioned(
            bottom: 8,
            left: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.5),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(
                children: [
                  const Icon(Icons.remove_red_eye, size: 16, color: Colors.white),
                  const SizedBox(width: 4),
                  Text(
                    '${stream.viewerCount}',
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
